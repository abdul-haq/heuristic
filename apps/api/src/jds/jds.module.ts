import {
  Module,
  Injectable,
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { PrismaService } from '../prisma/prisma.module';
import { LLMService, EmbeddingsService } from '../llm/llm.module';
import { BulletsService } from '../bullets/bullets.module';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';
import { BulletsModule } from '../bullets/bullets.module';

// ---------- DTOs ----------

export class CaptureJDDto {
  @IsString() rawText!: string;
  @IsOptional() @IsString() sourceUrl?: string;
  @IsOptional() @IsString() platform?: string;
}

// ---------- Prompts ----------

const EXTRACT_JD_SYSTEM = `You extract structured fields from job descriptions.

Return ONLY valid JSON matching this schema:
{
  "companyName": string | null,
  "roleTitle": string | null,
  "location": string | null,
  "language": "en" | "de",
  "germanLevel": "none" | "a1" | "a2" | "b1" | "b2" | "c1" | null,
  "workFormat": "werkstudent" | "internship" | "fulltime" | "other" | null,
  "mustHaves": string[],
  "niceToHaves": string[]
}

Rules:
- "language" = the language the JD itself is written in.
- "germanLevel" = the level the JD requires from the candidate, not the JD's own language.
- mustHaves / niceToHaves: short technical or domain skills, max 10 items each.
- If a field is absent, return null (or [] for arrays).`;

const REWRITE_BULLET_SYSTEM = `You tailor a candidate's CV bullet to better match a job description.

Rules:
- Never invent experience the candidate doesn't have.
- Preserve all specific numbers and facts from the original bullet.
- Reuse vocabulary from the JD only when it honestly applies.
- Keep the rewrite under 25 words.
- Return ONLY the rewritten bullet, no preamble, no quotes.`;

// ---------- Service ----------

@Injectable()
export class JdsService {
  constructor(
    private prisma: PrismaService,
    private llm: LLMService,
    private embeddings: EmbeddingsService,
    private bullets: BulletsService,
  ) {}

  async capture(userId: string, dto: CaptureJDDto) {
    // 1. LLM extracts structured fields
    const extractionRes = await this.llm.complete({
      taskType: 'extract_jd',
      userId,
      jsonMode: true,
      messages: [
        { role: 'system', content: EXTRACT_JD_SYSTEM },
        { role: 'user', content: dto.rawText },
      ],
    });

    let extracted: any = {};
    try {
      extracted = JSON.parse(extractionRes.text);
    } catch {
      // If the model returned malformed JSON, store raw and let user fix it
      extracted = { error: 'extraction_failed', raw: extractionRes.text };
    }

    // 2. Embed the JD text for later retrieval
    const embedding = await this.embeddings.embed(dto.rawText.slice(0, 2000));
    const embeddingLiteral = `[${embedding.join(',')}]`;

    // 3. Insert (raw query because of vector column)
    const id = (
      await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `
        INSERT INTO "JobDescription" (id, "userId", "sourceUrl", platform, "companyName",
            "roleTitle", location, language, "germanLevel", "workFormat",
            "rawText", extracted, embedding, "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::vector, NOW(), NOW())
        RETURNING id
        `,
        userId,
        dto.sourceUrl ?? null,
        dto.platform ?? null,
        extracted.companyName ?? null,
        extracted.roleTitle ?? null,
        extracted.location ?? null,
        extracted.language ?? null,
        extracted.germanLevel ?? null,
        extracted.workFormat ?? null,
        dto.rawText,
        JSON.stringify(extracted),
        embeddingLiteral,
      )
    )[0].id;

    return this.prisma.jobDescription.findUniqueOrThrow({ where: { id } });
  }

  async list(userId: string) {
    return this.prisma.jobDescription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, companyName: true, roleTitle: true, location: true,
        language: true, germanLevel: true, workFormat: true,
        platform: true, createdAt: true,
      },
    });
  }

  async get(userId: string, id: string) {
    const jd = await this.prisma.jobDescription.findFirst({ where: { id, userId } });
    if (!jd) throw new NotFoundException();
    return jd;
  }

  /**
   * The RAG endpoint: given a stored JD, retrieve top-K matching bullets
   * and ask the LLM to rewrite each one for this specific JD.
   */
  async suggestRewrites(userId: string, jdId: string) {
    const jd = await this.get(userId, jdId);

    // Re-embed the JD text (or read stored embedding via raw SQL)
    const rows = await this.prisma.$queryRawUnsafe<Array<{ embedding: string }>>(
      `SELECT embedding::text FROM "JobDescription" WHERE id = $1`,
      jdId,
    );
    if (!rows[0]?.embedding) throw new Error('JD has no embedding');
    const jdEmbedding = JSON.parse(rows[0].embedding) as number[];

    // Retrieve top-K bullets
    const topBullets = await this.bullets.retrieveTopKForJD(userId, jdEmbedding, 6);

    // Ask the LLM to rewrite each one
    const rewrites = await Promise.all(
      topBullets.map(async (b) => {
        const res = await this.llm.complete({
          taskType: 'rewrite_bullet',
          userId,
          maxTokens: 200,
          messages: [
            { role: 'system', content: REWRITE_BULLET_SYSTEM },
            {
              role: 'user',
              content: `JOB DESCRIPTION:\n${jd.rawText.slice(0, 1500)}\n\nORIGINAL BULLET:\n${b.text}\n\nRewrite the bullet for this JD.`,
            },
          ],
        });
        return {
          bulletId: b.id,
          original: b.text,
          rewritten: res.text.trim(),
          company: b.company,
          distance: b.distance,
        };
      }),
    );

    return { jd, rewrites };
  }
}

// ---------- Controller ----------

@UseGuards(JwtAuthGuard)
@Controller('jds')
export class JdsController {
  constructor(private service: JdsService) {}

  @Post()
  capture(@CurrentUser() user: { id: string }, @Body() dto: CaptureJDDto) {
    return this.service.capture(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.service.list(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.get(user.id, id);
  }

  @Post(':id/suggest-rewrites')
  suggestRewrites(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.suggestRewrites(user.id, id);
  }
}

// ---------- Module ----------


@Module({
  imports: [LlmModule, BulletsModule],
  controllers: [JdsController],
  providers: [JdsService],
})
export class JdsModule {}
