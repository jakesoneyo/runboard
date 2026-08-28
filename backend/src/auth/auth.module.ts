import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    AuditModule,
    // registerAsync: 팩토리는 모듈 컴파일 시점에 실행된다 — register()의 정적 옵션 객체는
    // 이 파일이 import되는 순간(테스트의 beforeAll보다 먼저) process.env를 읽어버려 시크릿이 비어 있을 수 있다.
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // RunsGateway가 소켓 핸드셰이크에서 REST와 "같은" 검증(같은 시크릿의 JwtService.verifyAsync)을
  // 재사용하도록 JwtModule을 노출한다 — 소켓 전용 JWT 설정을 새로 만들면 시크릿/TTL이 갈라질 위험이 있다.
  exports: [JwtModule],
})
export class AuthModule {}
