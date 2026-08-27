import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** 전역 모듈로 등록해 모든 도메인 모듈이 별도 import 없이 PrismaService를 주입받게 한다. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
