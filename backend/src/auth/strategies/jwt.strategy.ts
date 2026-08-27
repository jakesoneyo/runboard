import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  jti: string;
}

/**
 * 액세스 토큰은 "누구인가"(sub, email)만 검증한다 — 조직/역할은 절대 담지 않는다(ARCHITECTURE.md 3장).
 * 강등·추방이 토큰 만료(15분) 전에 반영되게 하려면 권한은 항상 요청 시점 Membership 조회로 판단해야 한다.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  validate(payload: AccessTokenPayload) {
    return { id: payload.sub, email: payload.email };
  }
}
