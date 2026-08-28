import { useState, type FormEvent } from "react";
import {
  DEMO_CREDENTIALS,
  loginSchema,
  registerSchema,
} from "../schemas/auth.schema";
import { useLogin, useRegister } from "../features/auth/hooks";
import { getErrorMessage } from "../lib/errors";
import { fieldErrors } from "../lib/zod-errors";
import { Button } from "../components/ui/Button";
import { Field, TextInput } from "../components/ui/Field";

/**
 * DESIGN.md/variant-c-bold "SCREEN 1: LOGIN" 마크업을 그대로 옮긴 2단 레이아웃.
 * 왼쪽(잉크 배경)은 브랜드/카피, 오른쪽 박스가 실제 로그인·회원가입 폼.
 */
export function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[1.4fr_1fr]">
      <div className="relative flex flex-col justify-between overflow-hidden bg-ink px-8 py-12 text-paper md:px-14 md:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 48px)",
          }}
        />
        <div className="relative text-[11px] font-bold tracking-[0.08em] opacity-60">
          MULTI_TENANT_QA_CONTROL
        </div>
        <div className="relative">
          <h1 className="mb-5 text-[clamp(48px,7vw,84px)] leading-[0.95] font-extrabold text-white">
            RUN
            <br />
            BOARD
          </h1>
          <p className="max-w-[46ch] text-[14px] leading-relaxed text-paper/70">
            여러 조직의 테스트 스위트, 실행 기록, 감사 로그를 한 화면에서
            통제한다. 팀별 권한과 이력이 분리된 채로 남는다.
          </p>
        </div>
        <div className="relative flex flex-wrap gap-7 text-[11px] font-bold opacity-75">
          <span>
            STATUS
            <span className="mt-1 block text-[15px] text-accent-tint">
              OPERATIONAL
            </span>
          </span>
          <span>
            AUTH
            <span className="mt-1 block text-[15px] text-accent-tint">
              JWT + REFRESH ROTATION
            </span>
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px] border-2 border-ink bg-paper-raised p-9">
          {mode === "login" ? <LoginForm /> : <RegisterForm />}

          <div className="my-5 flex items-center gap-3 text-[10.5px] font-bold text-ink/50">
            <div className="h-[1.5px] flex-1 bg-paper-line-strong" />
            <span>OR</span>
            <div className="h-[1.5px] flex-1 bg-paper-line-strong" />
          </div>

          <DemoLoginButton />

          <p className="mt-5 text-center text-[11px] text-ink/60">
            {mode === "login" ? (
              <>
                계정이 없나요?{" "}
                <button
                  type="button"
                  className="font-bold text-accent-ink underline"
                  onClick={() => setMode("register")}
                >
                  회원가입
                </button>
              </>
            ) : (
              <>
                이미 계정이 있나요?{" "}
                <button
                  type="button"
                  className="font-bold text-accent-ink underline"
                  onClick={() => setMode("login")}
                >
                  로그인
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const login = useLogin();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    login.mutate(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="mb-1.5 text-[18px] font-extrabold">SIGN_IN</h2>
      <p className="mb-7 text-[12px] text-ink/60">
        계정으로 로그인하고 조직 작업 공간으로 이동합니다.
      </p>

      <Field label="이메일" htmlFor="login-email" error={errors.email}>
        <TextInput
          id="login-email"
          autoComplete="username"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="비밀번호" htmlFor="login-password" error={errors.password}>
        <TextInput
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="********"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      {login.isError && (
        <p className="mb-3 text-[11px] font-bold text-fail">
          {getErrorMessage(login.error)}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={login.isPending}
      >
        {login.isPending ? "로그인 중..." : "로그인"}
      </Button>
    </form>
  );
}

function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const register = useRegister();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = registerSchema.safeParse({ email, password, name });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    register.mutate(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="mb-1.5 text-[18px] font-extrabold">SIGN_UP</h2>
      <p className="mb-7 text-[12px] text-ink/60">
        실이메일로 새 계정을 만듭니다(admin 우회는 로그인에만 적용).
      </p>

      <Field label="이름" htmlFor="register-name" error={errors.name}>
        <TextInput
          id="register-name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="이메일" htmlFor="register-email" error={errors.email}>
        <TextInput
          id="register-email"
          type="email"
          autoComplete="username"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field
        label="비밀번호"
        htmlFor="register-password"
        error={errors.password}
        helper="8자 이상"
      >
        <TextInput
          id="register-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      {register.isError && (
        <p className="mb-3 text-[11px] font-bold text-fail">
          {getErrorMessage(register.error)}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={register.isPending}
      >
        {register.isPending ? "가입 중..." : "회원가입"}
      </Button>
    </form>
  );
}

/**
 * 데모 로그인: CLAUDE.md 고정 문구 — 숨기지 않고 정식 기능으로 노출한다.
 * admin/admin은 정상 로그인 절차(bcrypt 비교)를 그대로 통과해야 하는 계정이며,
 * 시드가 아직 없는 초기 상태에서는 AUTH_INVALID_CREDENTIALS 에러가 그대로 보여야 정상이다.
 */
function DemoLoginButton() {
  const login = useLogin();

  return (
    <div>
      <Button
        type="button"
        variant="accent"
        className="w-full"
        disabled={login.isPending}
        onClick={() => login.mutate(DEMO_CREDENTIALS)}
      >
        회원가입 없이 둘러보기
      </Button>
      <p className="mt-2.5 text-center text-[11px] text-ink/60">
        회원가입 없이 체험해 볼 수 있습니다.
      </p>
    </div>
  );
}
