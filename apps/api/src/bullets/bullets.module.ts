import {
  Module,
  Injectable,
  Controller,
  Get,
  UseGuards,
  Param,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { EmbeddingsService } from '../llm/llm.module';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';

@Injectable()
export class BulletsService {
  constructor(
    private prisma: PrismaService,
    private embeddings: EmbeddingsService,
  ) {}

  async listForUser(userId: string) {
    return this.prisma.cVBullet.findMany({
      where: { userId },
      orderBy: [{ company: 'asc' }, { ordering: 'asc' }],
    });
  }

  /**
   * Embed a bullet's text and store it. Called when a bullet is created or edited.
   * pgvector doesn't have a Prisma type so we use raw SQL for the embedding column.
   */
  async embedAndStore(bulletId: string, text: string) {
    const vec = await this.embeddings.embed(text);
    // Postgres vector literal format: '[0.1,0.2,...]'
    const literal = `[${vec.join(',')}]`;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "CVBullet" SET embedding = $1::vector WHERE id = $2`,
      literal,
      bulletId,
    );
  }

  /**
   * Given a JD embedding, find the top-K most relevant CV bullets via cosine similarity.
   * pgvector's `<=>` operator returns cosine *distance* (0 = identical, 2 = opposite),
   * so we order ascending.
   */
  async retrieveTopKForJD(
    userId: string,
    jdEmbedding: number[],
    k = 8,
  ): Promise<Array<{ id: string; text: string; company: string | null; distance: number }>> {
    const literal = `[${jdEmbedding.join(',')}]`;
    return this.prisma.$queryRawUnsafe(
      `
      SELECT id, text, company,
             (embedding <=> $1::vector) AS distance
      FROM "CVBullet"
      WHERE "userId" = $2 AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3
      `,
      literal,
      userId,
      k,
    );
  }
}

@UseGuards(JwtAuthGuard)
@Controller('bullets')
export class BulletsController {
  constructor(private service: BulletsService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.service.listForUser(user.id);
  }
}

@Module({
  imports: [LlmModule],
  controllers: [BulletsController],
  providers: [BulletsService],
  exports: [BulletsService],
})
export class BulletsModule {}