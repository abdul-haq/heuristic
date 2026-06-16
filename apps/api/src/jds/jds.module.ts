import {
  Module,
  Injectable,
  Controller,
  Post,
  Get,
  Body,
  Delete,
  Patch,
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

const COVER_LETTER_SYSTEM = `You write short, professional cover letters for job applications.

Rules:
- Use ONLY facts from the provided CV bullets. Never invent experience.
- Keep it to 4 paragraphs: opening, relevant experience, why this company, closing.
- Total length: 150-250 words.
- Tone: professional but warm, not robotic.
- If the JD is in German, write the letter in German using formal Sie and proper business conventions (Sehr geehrte Damen und Herren, Mit freundlichen Grüßen).
- If the JD is in English, write in English.
- Do not use clichés like "I am writing to express my interest" or "Ich bewerbe mich hiermit".
- Reference specific requirements from the JD and match them to specific experience from the CV.
- End with availability (mention Werkstudent 15-20h/week if the role is a Werkstudent position).`;

// ---------- Service ----------

@Injectable()
export class JdsService {
  constructor(
    private prisma: PrismaService,
    private llm: LLMService,
    private embeddings: EmbeddingsService,
    private bullets: BulletsService,
  ) { }

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
        platform: true, status: true, createdAt: true,
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
  async delete(userId: string, id: string) {
    const jd = await this.get(userId, id);
    await this.prisma.jobDescription.delete({ where: { id } });
    return { success: true, id };
  }

  async updateStatus(userId: string, id: string, status: string) {
    const jd = await this.get(userId, id);
    return this.prisma.jobDescription.update({
      where: { id },
      data: { status },
    });
  }

  async analyze(userId: string, jdId: string) {
    const jd = await this.get(userId, jdId);
    const extracted = (jd.extracted as any) ?? {};

    // 1. Get user's bullets with their skills
    const bullets = await this.bullets.listForUser(userId);
    const userSkills = [...new Set(bullets.flatMap((b: any) => b.skills ?? []))];

    // 2. Keyword matching
    const mustHaves: string[] = extracted.mustHaves ?? [];
    const niceToHaves: string[] = extracted.niceToHaves ?? [];

    const matchedMust = mustHaves.filter((skill: string) =>
      userSkills.some((s: string) => skill.toLowerCase().includes(s) || s.includes(skill.toLowerCase()))
    );
    const missingMust = mustHaves.filter((skill: string) => !matchedMust.includes(skill));

    const matchedNice = niceToHaves.filter((skill: string) =>
      userSkills.some((s: string) => skill.toLowerCase().includes(s) || s.includes(skill.toLowerCase()))
    );

    // 3. Cosine similarity score (0-100)
    const rows = await this.prisma.$queryRawUnsafe<Array<{ embedding: string }>>(
      `SELECT embedding::text FROM "JobDescription" WHERE id = $1`,
      jdId,
    );
    let semanticScore = 0;
    if (rows[0]?.embedding) {
      const jdEmbedding = JSON.parse(rows[0].embedding) as number[];
      const topBullets = await this.bullets.retrieveTopKForJD(userId, jdEmbedding, 6);
      if (topBullets.length > 0) {
        const avgDistance = topBullets.reduce((sum, b) => sum + b.distance, 0) / topBullets.length;
        semanticScore = Math.round((1 - avgDistance / 2) * 100);
      }
    }

    // 4. Keyword coverage score
    const totalKeywords = mustHaves.length + niceToHaves.length;
    const matchedKeywords = matchedMust.length + matchedNice.length;
    const keywordScore = totalKeywords > 0 ? Math.round((matchedKeywords / totalKeywords) * 100) : 0;

    // 5. Combined match score (weighted: 60% semantic, 40% keyword)
    const matchScore = Math.round(semanticScore * 0.6 + keywordScore * 0.4);

    // 6. Red flags
    const redFlags: string[] = [];
    const germanLevel = extracted.germanLevel;
    if (germanLevel && germanLevel !== 'none' && germanLevel !== 'a1' && germanLevel !== 'a2') {
      redFlags.push(`Requires German ${germanLevel.toUpperCase()} (you have A2)`);
    }
    if (extracted.workFormat === 'fulltime') {
      redFlags.push('This is a full-time role, not Werkstudent');
    }

    // 7. Update the match score in the database
    await this.prisma.$executeRawUnsafe(
      `UPDATE "JobDescription" SET "updatedAt" = NOW() WHERE id = $1`,
      jdId,
    );

    return {
      matchScore,
      semanticScore,
      keywordScore,
      matched: { mustHaves: matchedMust, niceToHaves: matchedNice },
      missing: { mustHaves: missingMust },
      redFlags,
      userSkills,
    };
  }

  async generateCoverLetter(userId: string, jdId: string) {
    const jd = await this.get(userId, jdId);
    const extracted = (jd.extracted as any) ?? {};

    // Get the user's top matching bullets for context
    const rows = await this.prisma.$queryRawUnsafe<Array<{ embedding: string }>>(
      `SELECT embedding::text FROM "JobDescription" WHERE id = $1`,
      jdId,
    );

    let relevantBullets: string[] = [];
    if (rows[0]?.embedding) {
      const jdEmbedding = JSON.parse(rows[0].embedding) as number[];
      const topBullets = await this.bullets.retrieveTopKForJD(userId, jdEmbedding, 6);
      relevantBullets = topBullets.map((b) => `- ${b.text}`);
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const prompt = `JOB DESCRIPTION:
    Company: ${extracted.companyName ?? 'Unknown'}
    Role: ${extracted.roleTitle ?? 'Unknown'}
    Location: ${jd.location ?? 'Not specified'}
    Language: ${jd.language ?? 'en'}
    Work format: ${extracted.workFormat ?? 'unknown'}
    
    Full JD text:
    ${jd.rawText.slice(0, 2000)}
    
    CANDIDATE'S RELEVANT CV BULLETS:
    ${relevantBullets.join('\n')}
    
    CANDIDATE INFO:
    Name: ${user.name ?? 'Abdul Haq'}
    Currently: M.Sc. student in High Integrity Systems at Frankfurt University of Applied Sciences
    German level: A2 (improving toward B1)
    
    Write a cover letter for this application.`;

    const res = await this.llm.complete({
      taskType: 'draft_letter',
      userId,
      maxTokens: 1000,
      messages: [
        { role: 'system', content: COVER_LETTER_SYSTEM },
        { role: 'user', content: prompt },
      ],
    });

    return {
      coverLetter: res.text.trim(),
      language: jd.language ?? 'en',
      model: res.model,
      provider: res.provider,
    };
  }
}

// ---------- Controller ----------

@UseGuards(JwtAuthGuard)
@Controller('jds')
export class JdsController {
  constructor(private service: JdsService) { }

  @Post()
  capture(@CurrentUser() user: { id: string }, @Body() dto: CaptureJDDto) {
    return this.service.capture(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.service.list(user.id);
  }

  @Get(':id/analyze')
  analyze(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.analyze(user.id, id);
  }

  @Post(':id/cover-letter')
  generateCoverLetter(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.generateCoverLetter(user.id, id);
  }

  @Get(':id')
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.get(user.id, id);
  }

  @Post(':id/suggest-rewrites')
  suggestRewrites(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.suggestRewrites(user.id, id);
  }

  @Delete(':id')
  delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.delete(user.id, id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.service.updateStatus(user.id, id, body.status);
  }
}

// ---------- Module ----------


@Module({
  imports: [LlmModule, BulletsModule],
  controllers: [JdsController],
  providers: [JdsService],
})
export class JdsModule { }
