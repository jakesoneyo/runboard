// 백엔드 backend/src/auth/dto/login.schema.ts와 필드 형태만 동일하게 맞춘다(모노레포가 아니라 직접 import 불가).
import { z } from "zod";

/** 데모 계정 규정: email === 'admin' 리터럴 하나에 대해서만 이메일 형식 검증을 우회한다. */
const loginEmailSchema = z
  .string()
  .min(1, "이메일을 입력해주세요.")
  .refine(
    (value) => value === "admin" || z.string().email().safeParse(value).success,
    { message: "올바른 이메일 형식이 아닙니다." }
  );

export const loginSchema = z.object({
  email: loginEmailSchema,
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** 데모 로그인 버튼이 시도하는 고정 자격증명 — 실제 인증은 정상 로그인 절차(bcrypt 비교)를 그대로 탄다. */
export const DEMO_CREDENTIALS: LoginInput = {
  email: "admin",
  password: "admin",
};

/** 회원가입은 항상 실이메일만 받는다 — 'admin' 우회는 로그인 스키마에만 존재한다(백엔드와 동일 규칙). */
export const registerSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
  name: z.string().min(1, "이름을 입력해주세요.").max(100),
});

export type RegisterInput = z.infer<typeof registerSchema>;
