import axios from "axios";
import type { ApiErrorBody } from "../types/api";

/** API.md 공통 에러 포맷의 message를 최우선으로 뽑아 사용자에게 그대로 보여준다. */
export function getErrorMessage(
  error: unknown,
  fallback = "문제가 발생했습니다. 잠시 후 다시 시도해주세요."
): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? fallback;
  }
  return fallback;
}
