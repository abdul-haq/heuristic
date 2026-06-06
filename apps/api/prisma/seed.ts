/**
 * Heuristic seed script.
 *
 * Populates the database with:
 *   1. A default user (you)
 *   2. Your CV variants
 *   3. Your real CV bullets, tagged with skills
 *   4. Three sample JDs for development
 *
 * Run: pnpm db:seed
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { pipeline } from '@xenova/transformers';

const prisma = new PrismaClient();

async function embed(text: string, pipe: any): Promise<number[]> {
  const out = await pipe(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data as Float32Array);
}

async function main() {
  console.log('Loading embedding model (one-time download on first run, ~30MB)...');
  const pipe = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');

  // ---- 1. User ----
  const email = 'abdulhaq.dev@gmail.com';
  const passwordHash = await bcrypt.hash('changeme123', 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name: 'Abdul Haq' },
  });
  console.log(`User: ${user.email} (password: changeme123)`);

  // ---- 2. CV variants ----
  const variants = ['base', 'full-stack', 'frontend', 'php'];
  const variantMap: Record<string, string> = {};
  for (const slug of variants) {
    const v = await prisma.cVVariant.upsert({
      where: { userId_slug: { userId: user.id, slug } },
      update: {},
      create: {
        userId: user.id,
        slug,
        name: slug.charAt(0).toUpperCase() + slug.slice(1),
      },
    });
    variantMap[slug] = v.id;
  }

  // ---- 3. Bullets — your real CV content, taken from the CV files we built ----
  // EDIT THIS LIST to soften any bullets you find inflated and add anything missing.
  const bullets = [
    // Atompoint
    { company: 'Atompoint', role: 'Full-Stack Developer', text: 'Built a QR/ID check-in system used at events with up to 15k attendees, focused on response time under 500ms.', skills: ['nodejs', 'php', 'mysql', 'caching', 'performance'], category: 'backend' },
    { company: 'Atompoint', role: 'Full-Stack Developer', text: 'Designed identity verification flow with ID validation and liveness detection; end-to-end encryption to meet GDPR requirements.', skills: ['security', 'gdpr', 'auth', 'encryption'], category: 'backend' },
    { company: 'Atompoint', role: 'Full-Stack Developer', text: 'Built Shotbox on a custom WordPress theme with custom plugins in core PHP, including database schema and admin panels.', skills: ['php', 'wordpress', 'mysql', 'custom-plugins'], category: 'backend' },
    { company: 'Atompoint', role: 'Full-Stack Developer', text: 'Improved web performance to FCP ~0.8s and PageSpeed 96 via AVIF/WebP, CDN caching, and lazy-loading.', skills: ['performance', 'cdn', 'webvitals', 'frontend'], category: 'perf' },
    { company: 'Atompoint', role: 'Full-Stack Developer', text: 'Built classroom management portal integrating the Zoom API with attendance and recordings.', skills: ['api-integration', 'zoom', 'nodejs'], category: 'backend' },
    { company: 'Atompoint', role: 'Full-Stack Developer', text: 'Worked in a 3-engineer Agile team on bi-weekly sprints; participated in planning, code review, shipped 3 projects to production.', skills: ['agile', 'scrum', 'teamwork', 'code-review'], category: 'team' },

    // Cigul
    { company: 'Cigul', role: 'Full-Stack Developer', text: 'Built and maintained 30+ client websites on WordPress with custom PHP themes and plugins.', skills: ['php', 'wordpress', 'custom-themes'], category: 'backend' },
    { company: 'Cigul', role: 'Full-Stack Developer', text: 'Implemented custom backend logic, dynamic filtering, and WooCommerce extensions for e-commerce clients.', skills: ['php', 'woocommerce', 'ecommerce'], category: 'backend' },
    { company: 'Cigul', role: 'Full-Stack Developer', text: 'Integrated Stripe and PayPal payment gateways with secure checkout flows.', skills: ['stripe', 'paypal', 'payments', 'php'], category: 'backend' },
    { company: 'Cigul', role: 'Full-Stack Developer', text: 'Translated Figma designs into responsive production sites targeting sub-2s load times and 90+ Lighthouse scores.', skills: ['figma', 'css', 'html', 'performance'], category: 'frontend' },

    // Arkitektz
    { company: 'Arkitektz', role: 'Frontend Developer', text: 'Shipped 15+ UI features in Angular and React; contributed to a TypeScript migration.', skills: ['angular', 'react', 'typescript'], category: 'frontend' },
    { company: 'Arkitektz', role: 'Frontend Developer', text: 'Modernized parts of a legacy codebase toward WCAG 2.1 AA accessibility compliance.', skills: ['accessibility', 'wcag', 'refactoring'], category: 'frontend' },
    { company: 'Arkitektz', role: 'Frontend Developer', text: 'Reduced bundle sizes through refactoring and route-level code splitting.', skills: ['performance', 'webpack', 'code-splitting'], category: 'perf' },

    // Capstone project
    { company: 'Serve Your Taste', role: 'University Capstone', text: 'Built a mobile marketplace connecting cloud kitchens with customers using React Native, NestJS, and Firebase; handled auth, order flow, and notifications for ~500 beta orders.', skills: ['react-native', 'nestjs', 'firebase', 'mobile'], category: 'fullstack' },
  ];

  // Delete old bullets to keep seed idempotent
  await prisma.cVBullet.deleteMany({ where: { userId: user.id } });

  console.log(`Embedding and inserting ${bullets.length} bullets...`);
  for (const b of bullets) {
    const created = await prisma.cVBullet.create({
      data: {
        userId: user.id,
        section: 'experience',
        company: b.company,
        role: b.role,
        text: b.text,
        skills: b.skills,
        category: b.category,
      },
    });
    const vec = await embed(b.text, pipe);
    const literal = `[${vec.join(',')}]`;
    await prisma.$executeRawUnsafe(
      `UPDATE "CVBullet" SET embedding = $1::vector WHERE id = $2`,
      literal,
      created.id,
    );
  }

  console.log(`Seeded ${bullets.length} bullets with embeddings.`);
  console.log('Done. Log in with abdulhaq.dev@gmail.com / changeme123 (change ASAP).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
