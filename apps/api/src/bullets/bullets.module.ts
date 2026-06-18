import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../prisma/prisma.module';
import { EmbeddingsService } from '../llm/llm.module';
import { JwtAuthGuard, CurrentUser } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';
import { CvUploadService } from './cv-upload';

@Injectable()
export class BulletsService {
  constructor(
    private prisma: PrismaService,
    private embeddings: EmbeddingsService,
  ) { }

  async listForUser(userId: string) {
    return this.prisma.cVBullet.findMany({
      where: { userId },
      orderBy: [{ company: 'asc' }, { ordering: 'asc' }],
    });
  }

  async embedAndStore(bulletId: string, text: string) {
    const vec = await this.embeddings.embed(text);
    const literal = `[${vec.join(',')}]`;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "CVBullet" SET embedding = $1::vector WHERE id = $2`,
      literal,
      bulletId,
    );
  }

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

  async deleteBullet(userId: string, bulletId: string) {
    const bullet = await this.prisma.cVBullet.findFirst({ where: { id: bulletId, userId } });
    if (!bullet) throw new BadRequestException('Bullet not found');
    await this.prisma.cVBullet.delete({ where: { id: bulletId } });
    return { success: true, id: bulletId };
  }

  async getVariants(userId: string) {
    return this.prisma.cVVariant.findMany({
      where: { userId },
      include: {
        _count: { select: { bullets: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteAllForUser(userId: string) {
    const result = await this.prisma.cVBullet.deleteMany({ where: { userId } });
    return { deleted: result.count };
  }

  async normalizeCompanyNames(userId: string) {
    const aliases: Record<string, string> = {
      'Cigul (formerly Xeon Agency)': 'Cigul',
      'Xeon Agency': 'Cigul',
      'Cigul / Xeon Agency': 'Cigul',
      'Serve Your Taste University Capstone Project': 'Serve Your Taste',
      'Serve Your Taste Capstone': 'Serve Your Taste',
    };

    let updated = 0;
    for (const [from, to] of Object.entries(aliases)) {
      const result = await this.prisma.cVBullet.updateMany({
        where: { userId, company: from },
        data: { company: to },
      });
      updated += result.count;
    }
    return { updated };
  }
}

@UseGuards(JwtAuthGuard)
@Controller('bullets')
export class BulletsController {
  constructor(
    private service: BulletsService,
    private cvUpload: CvUploadService,
  ) { }

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.service.listForUser(user.id);
  }

  @Get('variants')
  variants(@CurrentUser() user: { id: string }) {
    return this.service.getVariants(user.id);
  }

   @Delete('all')
  deleteAll(@CurrentUser() user: { id: string }) {
    return this.service.deleteAllForUser(user.id);
  }

  @Post('normalize')
  normalize(@CurrentUser() user: { id: string }) {
    return this.service.normalizeCompanyNames(user.id);
  }

  @Delete(':id')
  deleteBullet(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.deleteBullet(user.id, id);
  }

  @Post('upload-cv')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCv(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are supported');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File must be under 5MB');
    }

    return this.cvUpload.processUpload(user.id, file.buffer);
  }
}

@Module({
  imports: [LlmModule],
  controllers: [BulletsController],
  providers: [BulletsService, CvUploadService],
  exports: [BulletsService],
})
export class BulletsModule { }