import { loginSchema } from './login.schema';

// CLAUDE.md 데모 계정 규정: 'admin' 리터럴 하나만 이메일 형식 검증을 우회한다.
describe('loginSchema', () => {
  it('허용: email === "admin" 리터럴은 이메일 형식이 아니어도 통과한다', () => {
    const result = loginSchema.safeParse({ email: 'admin', password: 'admin' });
    expect(result.success).toBe(true);
  });

  it('거부: "admin"이 아닌 비이메일 문자열은 400 대상(검증 실패)이다', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'whatever',
    });
    expect(result.success).toBe(false);
  });

  it('허용: 정상 이메일 형식은 그대로 통과한다', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'whatever',
    });
    expect(result.success).toBe(true);
  });
});
