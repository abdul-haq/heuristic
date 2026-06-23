import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

type BulletReplacement = {
    company: string | null;
    original: string;
    rewritten: string;
};

@Injectable()
export class CvCompilerService {
    constructor(private prisma: PrismaService) { }

    /**
     * Save the user's LaTeX template. Uploaded once, reused for every compile.
     */
    async saveTemplate(userId: string, template: string) {
        // Validate it looks like LaTeX
        if (!template.includes('\\begin{document}')) {
            throw new BadRequestException('This does not look like a valid LaTeX document');
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: { cvTemplate: template },
        });

        // Parse and return info about what we found
        const parsed = this.parseTemplate(template);
        return {
            success: true,
            companiesFound: parsed.companies,
            bulletCount: parsed.totalBullets,
        };
    }

    async getTemplate(userId: string) {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        return { template: user.cvTemplate };
    }

    /**
     * Parse a LaTeX CV template. Finds \resumeSubheading and \resumeItem patterns
     * to identify companies and their bullets.
     */
    private parseTemplate(template: string) {
        const experienceSection = this.extractSection(template, 'Professional Experience');

        const companies: string[] = [];
        let totalBullets = 0;

        if (!experienceSection) {
            return { companies, totalBullets };
        }

        const subheadingRegex =
            /\\resumeSubheading\s*\{([^}]*)\}\s*\{([^}]*)\}\s*\{([^}]*)\}\s*\{([^}]*)\}/g;

        let match: RegExpExecArray | null;

        while ((match = subheadingRegex.exec(experienceSection)) !== null) {
            companies.push(match[3].trim());
        }

        const bulletRegex = /\\resumeItem\{/g;

        while (bulletRegex.exec(experienceSection) !== null) {
            totalBullets++;
        }

        return { companies, totalBullets };
    }

    /**
     * Compile a tailored CV by replacing bullets in the user's template
     * with accepted rewrites for a specific JD.
     */
    async compileTailoredCV(userId: string, jdId: string) {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

        if (!user.cvTemplate) {
            throw new BadRequestException('No CV template uploaded. Go to CV Bullets → upload your .tex file first.');
        }

        // Get latest rewrite set
        const rewriteSet = await this.prisma.rewriteSet.findFirst({
            where: { userId, jdId },
            orderBy: { createdAt: 'desc' },
            include: { items: { orderBy: { ordering: 'asc' } } },
        });

        if (!rewriteSet || rewriteSet.items.length === 0) {
            throw new BadRequestException('No rewrites found. Generate and accept rewrites first.');
        }

        // Use accepted items, fallback to all
        let items = rewriteSet.items.filter(i => i.accepted);
        if (items.length === 0) items = rewriteSet.items;

        // Group rewrites by company
        const rewritesByCompany: Record<string, string[]> = {};
        for (const item of items) {
            const company = item.company || 'Other';
            if (!rewritesByCompany[company]) rewritesByCompany[company] = [];
            rewritesByCompany[company].push(item.rewritten);
        }

        // Now walk through the template and replace bullets
        let latex = user.cvTemplate;
        latex = this.replaceBulletsInTemplate(latex, rewritesByCompany);

        // Also build plain text
        const plainText = this.buildPlainText(user.cvTemplate, rewritesByCompany);

        const bulletCount = items.length;

        return { latex, plainText, bulletCount };
    }

    /**
     * Replace \resumeItem{...} lines under each company's \resumeSubheading
     * with the tailored rewrites for that company.
     *
     * Strategy:
     * 1. Find each \resumeSubheading — extract the company name (3rd arg)
     * 2. Find the \begin{itemize}...\end{itemize} block after it
     * 3. If we have rewrites for that company, replace all \resumeItem lines
     * 4. If not, leave the original bullets untouched
     */
    private replaceBulletsInTemplate(
        template: string,
        rewritesByCompany: Record<string, string[]>,
    ): string {
        // Match each experience block: subheading + the itemize block that follows
        const blockRegex = /(\\resumeSubheading\s*\{[^}]*\}\s*\{[^}]*\}\s*\{([^}]*)\}\s*\{[^}]*\}[\s\S]*?\\begin\{itemize\}[^]*?)(\\resumeItem\{[^]*?)(\\end\{itemize\})/g;

        let result = template;

        // For each company we have rewrites for, find and replace
        for (const [company, bullets] of Object.entries(rewritesByCompany)) {
            // Build new bullet lines
            const newBulletLines = bullets
                .map(b => `        \\resumeItem{${this.escapeLatex(b)}}`)
                .join('\n');

            // Find the block for this company and replace its bullets
            const companyBlockRegex = new RegExp(
                `(\\\\resumeSubheading\\s*\\{[^}]*\\}\\s*\\{[^}]*\\}\\s*\\{[^}]*${this.escapeRegex(company)}[^}]*\\}\\s*\\{[^}]*\\}[\\s\\S]*?\\\\begin\\{itemize\\}[^\\n]*\\n)([\\s\\S]*?)(\\s*\\\\end\\{itemize\\})`,
            );

            const match = companyBlockRegex.exec(result);
            if (match) {
                result = result.replace(
                    match[0],
                    match[1] + newBulletLines + '\n' + match[3],
                );
            }
        }

        return result;
    }

    /**
     * Build a plain text CV from the template structure + rewrites
     */
    private buildPlainText(
        template: string,
        rewritesByCompany: Record<string, string[]>,
    ): string {
        const lines: string[] = [];
        lines.push('PROFESSIONAL EXPERIENCE\n');

        const experienceSection = this.extractSection(template, 'Professional Experience');

        if (!experienceSection) {
            return lines.join('\n');
        }

        // Extract subheadings from template for structure
        const subheadingRegex = /\\resumeSubheading\s*\{([^}]*)\}\s*\{([^}]*)\}\s*\{([^}]*)\}\s*\{([^}]*)\}/g;

        // Get all original bullets per company from template
        const originalByCompany: Record<string, string[]> = {};
        const companies: Array<{ role: string; dates: string; company: string; location: string }> = [];

        let match;
        while ((match = subheadingRegex.exec(experienceSection)) !== null) {
            const company = match[3].trim();
            companies.push({
                role: match[1].trim(),
                dates: match[2].trim(),
                company,
                location: match[4].trim(),
            });
        }

        // Extract original bullets per section
        const sections = experienceSection.split(/\\resumeSubheading/);
        for (let i = 1; i < sections.length; i++) {
            const section = sections[i];
            const companyMatch = /\{[^}]*\}\s*\{[^}]*\}\s*\{([^}]*)\}/.exec(section);
            if (!companyMatch) continue;
            const company = companyMatch[1].trim();

            const bulletMatches = section.matchAll(/\\resumeItem\{([^}]+)\}/g);
            originalByCompany[company] = [];
            for (const bm of bulletMatches) {
                originalByCompany[company].push(bm[1]);
            }
        }

        // Build text output — use rewrites where available, originals where not
        // Only include experience section companies (first few before Projects)
        const experienceCompanies = companies;

        for (const c of experienceCompanies) {
            const bullets = rewritesByCompany[c.company] || originalByCompany[c.company] || [];
            if (bullets.length === 0) continue;

            lines.push(`${c.company} | ${c.role} | ${c.dates}`);
            for (const b of bullets) {
                lines.push(`• ${b}`);
            }
            lines.push('');
        }

        return lines.join('\n');
    }

    private escapeLatex(text: string): string {
        return text
            .replace(/&/g, '\\&')
            .replace(/%/g, '\\%')
            .replace(/#/g, '\\#');
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private extractSection(template: string, sectionName: string): string {
        const sectionRegex = new RegExp(
            `\\\\section\\*?\\s*\\{\\s*${this.escapeRegex(sectionName)}\\s*\\}`,
            'i',
        );

        const sectionMatch = sectionRegex.exec(template);

        if (!sectionMatch) {
            return '';
        }

        const start = sectionMatch.index + sectionMatch[0].length;
        const remaining = template.slice(start);

        const nextSectionMatch = /\\section\*?\s*\{[^}]+\}/.exec(remaining);

        if (!nextSectionMatch) {
            return remaining;
        }

        return remaining.slice(0, nextSectionMatch.index);
    }
}