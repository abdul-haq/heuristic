import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { LLMService, EmbeddingsService } from '../llm/llm.module';
import { PDFParse } from 'pdf-parse';

const EXTRACT_BULLETS_SYSTEM = `You extract CV/resume bullet points from raw text.

Return ONLY valid JSON matching this schema:
{
  "bullets": [
    {
      "text": "The bullet point text, cleaned up",
      "company": "Company name (e.g. 'Atompoint', 'Cigul', 'Arkitektz')",
      "role": "Job title",
      "section": "experience" | "project" | "education",
      "skills": ["skill1", "skill2"],
      "category": "backend" | "frontend" | "devops" | "team" | "perf" | "fullstack"
    }
  ]
}

Rules:
- Extract EVERY bullet point from work experience, projects, and education sections.
- Clean up formatting artifacts (line breaks, extra spaces, bullet characters).
- For company, use ONLY the primary name. Strip any qualifiers like "(formerly X)", "Inc.", etc.
- For skills, use short lowercase technical terms: "react", "nodejs", "php", "postgres", "typescript".
- For category, pick the best single fit.
- Do NOT invent or modify content — extract exactly what's there.
- Ignore headers, contact info, and section titles.`;

// Map LLM variations to canonical company names
const COMPANY_ALIASES: Record<string, string> = {
    'cigul (formerly xeon agency)': 'Cigul',
    'xeon agency': 'Cigul',
    'cigul / xeon agency': 'Cigul',
    'serve your taste university capstone project': 'Serve Your Taste',
    'serve your taste capstone': 'Serve Your Taste',
};

function normalizeCompany(name: string | null | undefined): string | null {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    return COMPANY_ALIASES[lower] || name.trim();
}

// Compute a similarity score between two strings (0 = identical, higher = more different)
// Simple approach: compare first 60 chars after normalizing whitespace
function isSimilarBullet(a: string, b: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').slice(0, 60).trim();
    return normalize(a) === normalize(b);
}

@Injectable()
export class CvUploadService {
    constructor(
        private prisma: PrismaService,
        private llm: LLMService,
        private embeddings: EmbeddingsService,
    ) { }

    async processUpload(userId: string, fileBuffer: Buffer, variantName?: string) {
        // 1. Extract text from PDF
        const parser = new PDFParse({ data: fileBuffer });
        let rawText = '';

        try {
            const parsed = await parser.getText();
            rawText = parsed.text;
        } finally {
            await parser.destroy();
        }

        if (!rawText || rawText.trim().length < 50) {
            throw new Error('Could not extract meaningful text from the PDF');
        }

        // 2. LLM extracts structured bullets
        const res = await this.llm.complete({
            taskType: 'extract_cv_bullets',
            userId,
            jsonMode: true,
            maxTokens: 6000,
            messages: [
                { role: 'system', content: EXTRACT_BULLETS_SYSTEM },
                { role: 'user', content: rawText.slice(0, 5000) },
            ],
        });

        let extracted: { bullets: any[] } = { bullets: [] };
        try {
            extracted = JSON.parse(res.text);
        } catch {
            throw new Error('LLM failed to parse CV into structured bullets');
        }

        if (!extracted.bullets || extracted.bullets.length === 0) {
            throw new Error('No bullets extracted from the CV');
        }

        // 3. Get existing bullets to detect duplicates
        const existingBullets = await this.prisma.cVBullet.findMany({
            where: { userId },
            select: { text: true },
        });

        // 4. Create/find variant
        const slug = (variantName || 'uploaded').toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const variant = await this.prisma.cVVariant.upsert({
            where: { userId_slug: { userId, slug } },
            update: {},
            create: { userId, slug, name: variantName || 'Uploaded CV' },
        });

        // 5. Save bullets, skipping duplicates
        const savedBullets: any[] = [];
        let skippedCount = 0;

        for (let i = 0; i < extracted.bullets.length; i++) {
            const b = extracted.bullets[i];

            // Skip if a similar bullet already exists
            const isDuplicate = existingBullets.some(eb => isSimilarBullet(eb.text, b.text));
            if (isDuplicate) {
                skippedCount++;
                continue;
            }

            const normalizedCompany = normalizeCompany(b.company);

            const bullet = await this.prisma.cVBullet.create({
                data: {
                    userId,
                    variantId: variant.id,
                    section: b.section || 'experience',
                    company: normalizedCompany,
                    role: b.role || null,
                    text: b.text,
                    skills: b.skills || [],
                    category: b.category || null,
                    ordering: i,
                },
            });

            // Track it so we don't double-add within this upload
            existingBullets.push({ text: b.text });

            // Embed the bullet
            const vec = await this.embeddings.embed(b.text);
            const literal = `[${vec.join(',')}]`;
            await this.prisma.$executeRawUnsafe(
                `UPDATE "CVBullet" SET embedding = $1::vector WHERE id = $2`,
                literal,
                bullet.id,
            );

            savedBullets.push({ ...bullet, skills: b.skills });
        }

        return {
            variantId: variant.id,
            variantName: variant.name,
            bulletsExtracted: savedBullets.length,
            bulletsSkippedAsDuplicate: skippedCount,
            bullets: savedBullets,
        };
    }
}