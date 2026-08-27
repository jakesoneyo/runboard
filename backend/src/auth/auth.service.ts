import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DomainException } from '../common/errors/domain-exception';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.schema';
import { RegisterDto } from './dto/register.schema';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일
// Render 무료 CPU 기준 트레이드오프(ARCHITECTURE.md 4장): cost 12는 콜드스타트 응답이 눈에 띄게 느려진다.
const BCRYPT_COST = 10;

type PrismaTx = Prisma.TransactionClient;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * 회원가입/로그인/리프레시 회전을 담당한다.
 * 비밀번호는 어떤 계정(데모 admin 포함)이든 항상 bcrypt.compare를 통과해야 한다 — 우회 경로 없음.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new DomainException(
        409,
        'AUTH_EMAIL_TAKEN',
        '이미 사용 중인 이메일입니다.',
      );
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name },
    });
    const tokens = await this.issueTokenPair(user);
    return { user: this.toPublicUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // 사용자 존재 여부를 노출하지 않기 위해 "계정 없음"과 "비밀번호 틀림"을 하나의 예외로 합친다.
    const passwordMatches = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;
    if (!user || !passwordMatches) {
      throw new DomainException(
        401,
        'AUTH_INVALID_CREDENTIALS',
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }
    const tokens = await this.issueTokenPair(user);
    const memberships = await this.loadMemberships(user.id);
    return { user: this.toPublicUser(user), ...tokens, memberships };
  }

  /**
   * 리프레시 회전 + 재사용 탐지(ARCHITECTURE.md 4장).
   * 이미 폐기된(=한 번 회전에 쓰인) 토큰이 다시 들어오면 탈취로 간주해 같은 familyId 전체를 폐기한다.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!stored) {
      throw new DomainException(
        401,
        'AUTH_REFRESH_INVALID',
        '유효하지 않은 refreshToken입니다.',
      );
    }
    if (stored.revokedAt) {
      // 주의: 이 폐기는 $transaction 밖에서 커밋돼야 한다. 안에서 하고 뒤이어 throw하면
      // Prisma interactive transaction이 통째로 롤백되어 "가족 전체 폐기"가 없었던 일이 된다(실제로 겪은 버그).
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new DomainException(
        401,
        'AUTH_REFRESH_REUSE',
        '이미 사용된 refreshToken이 재사용되었습니다.',
      );
    }
    if (stored.expiresAt < new Date()) {
      throw new DomainException(
        401,
        'AUTH_REFRESH_INVALID',
        '만료된 refreshToken입니다.',
      );
    }

    // 폐기 + 신규 발급만 원자적으로 묶는다(둘 중 하나만 반영되면 계열이 끊기거나 중복 유효 토큰이 남는다).
    return this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      const user = await tx.user.findUniqueOrThrow({
        where: { id: stored.userId },
      });
      return this.issueTokenPair(user, stored.familyId, tx);
    });
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    // 존재하지 않거나 이미 폐기된 토큰이어도 조용히 204 — "내 세션 종료"에 정보 노출은 불필요하다.
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const memberships = await this.loadMemberships(userId);
    return { user: this.toPublicUser(user), memberships };
  }

  private async issueTokenPair(
    user: User,
    familyId: string = randomUUID(),
    client: PrismaService | PrismaTx = this.prisma,
  ): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, jti: randomUUID() },
      { expiresIn: ACCESS_TOKEN_TTL },
    );
    const refreshTokenPlain = randomBytes(32).toString('base64url');
    await client.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshTokenPlain),
        familyId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return { accessToken, refreshToken: refreshTokenPlain };
  }

  /** 원문 refresh token은 저장하지 않는다 — DB 유출 시에도 토큰을 재구성할 수 없어야 한다. */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async loadMemberships(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
    return memberships.map((m) => ({
      organizationId: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    }));
  }

  private toPublicUser(user: User) {
    return { id: user.id, email: user.email, name: user.name };
  }
}
