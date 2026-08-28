import type { ZodError } from "zod";

/** 폼 필드별 에러 메시지로 매핑 — 같은 필드에 이슈가 여러 개면 첫 번째만 보여준다. */
export function fieldErrors(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    result[key] ??= issue.message;
  }
  return result;
}
