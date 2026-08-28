// axios 인스턴스 + 인증 배선: 요청마다 accessToken 부착, 401 → refresh 1회 재시도, 403 → 전역 토스트.
import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../stores/auth-store";
import { useUiStore } from "../stores/ui-store";
import type { ApiErrorBody } from "../types/api";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000/api",
});

// refresh 요청 전용 인스턴스 — 이 인스턴스에는 아래 응답 인터셉터를 걸지 않는다.
// 같은 인스턴스를 쓰면 refresh 자체가 401을 맞았을 때 인터셉터가 다시 refresh를 호출해
// 무한 루프에 빠질 수 있다.
const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000/api",
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

/**
 * 동시에 여러 요청이 401(만료된 access token)을 맞아도 refresh 호출은 딱 한 번만 나가야 한다.
 * refresh token은 회전(rotation)되어 재사용을 탐지하는 구조라(API.md AUTH_REFRESH_REUSE),
 * 큐잉 없이 각 요청이 독립적으로 refresh를 부르면 두 번째 호출부터는 이미 폐기된 토큰을 재사용한
 * 것으로 간주되어 계열 전체가 폐기되고 강제 로그아웃되는 버그가 난다.
 * → 진행 중인 refresh Promise를 모든 동시 요청이 공유(큐잉)해서 이 경합을 없앤다.
 */
let inFlightRefresh: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;
  try {
    const { data } = await refreshClient.post<{
      accessToken: string;
      refreshToken: string;
    }>("/auth/refresh", { refreshToken });
    useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    useAuthStore.getState().clearAuth();
    return null;
  }
}

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

// 로그인/회원가입/리프레시 자체의 401은 "자격 증명이 틀렸다"는 뜻이지 "토큰 만료"가 아니다 —
// 여기서 refresh를 시도하면 아직 없는 refreshToken으로 헛수고만 하거나, 무관한 이전 세션
// 토큰을 회전시켜 상태를 꼬이게 만들 수 있어 애초에 재시도 대상에서 제외한다.
const AUTH_ENDPOINTS = ["/auth/login", "/auth/register", "/auth/refresh"];

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as RetryableConfig | undefined;
    const status = error.response?.status;
    const isAuthEndpoint = AUTH_ENDPOINTS.some((path) =>
      config?.url?.includes(path)
    );

    if (status === 401 && config && !config._retried && !isAuthEndpoint) {
      config._retried = true;
      inFlightRefresh ??= refreshAccessToken().finally(() => {
        inFlightRefresh = null;
      });
      const newToken = await inFlightRefresh;
      if (newToken) {
        config.headers.set("Authorization", `Bearer ${newToken}`);
        return apiClient(config);
      }
    }

    if (status === 403) {
      useUiStore
        .getState()
        .showToast(
          error.response?.data?.message ?? "이 작업을 수행할 권한이 없습니다.",
          "error"
        );
    }

    return Promise.reject(error);
  }
);
