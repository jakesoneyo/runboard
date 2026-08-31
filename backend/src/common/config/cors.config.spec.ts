import { resolveCorsOrigin } from './cors.config';

// REVIEW.md 🔴-3 회귀 방지: 프로덕션에서 CORS_ORIGINS 미설정 시 `true`(전체허용)로
// 떨어지던 버그를 fail-fast로 막았는지 고정한다.
describe('resolveCorsOrigin', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('개발 환경에서 CORS_ORIGINS 미설정 시 전체 허용(true)을 유지한다', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CORS_ORIGINS;
    expect(resolveCorsOrigin()).toBe(true);
  });

  it('프로덕션에서 CORS_ORIGINS 미설정 시 throw한다(fail-fast)', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGINS;
    expect(() => resolveCorsOrigin()).toThrow(/CORS_ORIGINS/);
  });

  it('프로덕션에서 CORS_ORIGINS가 빈 문자열이면 throw한다', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = '  ,  ';
    expect(() => resolveCorsOrigin()).toThrow(/CORS_ORIGINS/);
  });

  it('프로덕션에서 CORS_ORIGINS를 콤마로 구분해 배열로 반환한다', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS =
      'https://runboard.vercel.app, https://runboard-staging.vercel.app';
    expect(resolveCorsOrigin()).toEqual([
      'https://runboard.vercel.app',
      'https://runboard-staging.vercel.app',
    ]);
  });
});
