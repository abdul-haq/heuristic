import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BulletsModule } from './bullets/bullets.module';
import { JdsModule } from './jds/jds.module';
import { LlmModule } from './llm/llm.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    LlmModule,
    BulletsModule,
    JdsModule,
  ],
})
export class AppModule {}
