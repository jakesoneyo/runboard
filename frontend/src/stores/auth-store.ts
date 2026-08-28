import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthResponse, LoginMembership, User } from "../types/api";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  memberships: LoginMembership[];
  /** 로그인/회원가입 성공 직후 세션 전체를 한 번에 채운다. */
  setAuth: (auth: AuthResponse) => void;
  /** axios 인터셉터의 refresh 회전 결과만 반영 — 나머지 세션 정보는 그대로 둔다. */
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

/**
 * accessToken/refreshToken을 localStorage에 영속화한다(zustand persist).
 * 데모 포트폴리오 특성상 새로고침해도 로그인 상태가 유지되어야 시연이 매끄럽다 —
 * 백엔드가 refresh 재사용 탐지·회전을 담당하므로 탈취 시에도 계열 전체 폐기로 방어된다.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      memberships: [],
      setAuth: (auth) =>
        set({
          user: auth.user,
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
          memberships: auth.memberships,
        }),
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          memberships: [],
        }),
    }),
    { name: "runboard-auth" }
  )
);
