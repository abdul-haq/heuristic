import { Module, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.module';

// ============================================================
// Types
// ============================================================

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  taskType: string; // for logging
  userId?: string;
  jsonMode?: boolean;
  maxTokens?: number;
}

export interface LLMResponse {
  text: string;
  model: string;
  provider: 'ollama' | 'anthropic';
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
}

// ============================================================
// Ollama provider — local, free
// ============================================================

@Injectable()
export class OllamaProvider {
  private baseUrl: string;
  private model: string;

  constructor(cfg: ConfigService) {
    this.baseUrl = cfg.get('OLLAMA_BASE_URL', 'http://localhost:11434');
    this.model = cfg.get('OLLAMA_MODEL', 'qwen2.5:3b');
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();

    // Ollama's /api/chat speaks an OpenAI-ish format
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: req.messages,
        stream: false,
        format: req.jsonMode ? 'json' : undefined,
        options: { num_predict: req.maxTokens ?? 1024 },
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    }

    const data: any = await res.json();
    return {
      text: data.message?.content ?? '',
      model: this.model,
      provider: 'ollama',
      inputTokens: data.prompt_eval_count,
      outputTokens: data.eval_count,
      latencyMs: Date.now() - start,
    };
  }
}

// ============================================================
// Anthropic provider — Claude Haiku
// ============================================================

@Injectable()
export class AnthropicProvider {
  private client: Anthropic | null = null;
  private model: string;

  constructor(cfg: ConfigService) {
    const key = cfg.get<string>('ANTHROPIC_API_KEY');
    this.model = cfg.get('ANTHROPIC_MODEL', 'claude-haiku-4-5');
    if (key) this.client = new Anthropic({ apiKey: key });
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY or use Ollama.');
    }

    const start = Date.now();

    // Anthropic separates system from messages
    const system = req.messages.find((m) => m.role === 'system')?.content;
    const messages = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens ?? 1024,
      system,
      messages,
    });

    const text = res.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    return {
      text,
      model: this.model,
      provider: 'anthropic',
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      latencyMs: Date.now() - start,
    };
  }
}

// ============================================================
// Embeddings — local via Transformers.js
// ============================================================

@Injectable()
export class EmbeddingsService {
  private pipelinePromise: Promise<any> | null = null;

  private async getPipeline() {
    if (!this.pipelinePromise) {
      // Lazy import — Transformers.js is heavy
      this.pipelinePromise = (async () => {
        const { pipeline } = await import('@xenova/transformers');
        return pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
      })();
    }
    return this.pipelinePromise;
  }

  /**
   * Embed a single string into a 384-dim vector.
   * Uses mean pooling + L2 normalization (standard for bge models).
   */
  async embed(text: string): Promise<number[]> {
    const pipe = await this.getPipeline();
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}

// ============================================================
// Router — picks provider per task, logs every call
// ============================================================

export type TaskRoute = 'ollama' | 'anthropic';

@Injectable()
export class LLMService {
  constructor(
    private ollama: OllamaProvider,
    private anthropic: AnthropicProvider,
    private prisma: PrismaService,
  ) {}

  /**
   * Route a request to the right provider based on task type.
   *
   * Default policy:
   *   - Extraction (parsing JDs, tagging skills) -> Ollama (local, free)
   *   - Quality-critical writing (bullet rewrites, cover letters) -> Claude
   *   - If Claude not configured, fall back to Ollama
   */
  private routeFor(taskType: string): TaskRoute {
    const claudeTasks = ['rewrite_bullet', 'draft_letter', 'critique_letter'];
    const wantsClaude = claudeTasks.includes(taskType);
    if (wantsClaude && this.anthropic.isConfigured()) return 'anthropic';
    return 'ollama';
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const route = this.routeFor(req.taskType);
    const provider = route === 'anthropic' ? this.anthropic : this.ollama;

    let response: LLMResponse;
    let success = true;
    let errorMessage: string | null = null;

    try {
      response = await provider.complete(req);
    } catch (err: any) {
      success = false;
      errorMessage = err.message;
      throw err;
    } finally {
      // Always log, even on failure
      await this.logCall(req, response! ?? null, route, success, errorMessage);
    }

    return response!;
  }

  private async logCall(
    req: LLMRequest,
    res: LLMResponse | null,
    provider: TaskRoute,
    success: boolean,
    errorMessage: string | null,
  ) {
    try {
      const costCents = res ? this.computeCostCents(provider, res) : 0;
      await this.prisma.lLMCall.create({
        data: {
          userId: req.userId,
          provider,
          model: res?.model ?? 'unknown',
          taskType: req.taskType,
          inputTokens: res?.inputTokens,
          outputTokens: res?.outputTokens,
          costCents,
          latencyMs: res?.latencyMs,
          success,
          errorMessage,
        },
      });
    } catch {
      // Logging shouldn't break the request
    }
  }

  /**
   * Compute cost in cents. Ollama is always free.
   * Claude Haiku 4.5: $1/MTok input, $5/MTok output.
   */
  private computeCostCents(provider: TaskRoute, res: LLMResponse): number {
    if (provider === 'ollama') return 0;
    const inputUsd = ((res.inputTokens ?? 0) / 1_000_000) * 1.0;
    const outputUsd = ((res.outputTokens ?? 0) / 1_000_000) * 5.0;
    return (inputUsd + outputUsd) * 100;
  }
}

// ============================================================
// Module
// ============================================================

@Module({
  providers: [OllamaProvider, AnthropicProvider, EmbeddingsService, LLMService],
  exports: [LLMService, EmbeddingsService],
})
export class LlmModule {}
