import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { login, logoutRequest, registerAccount } from "./api";
import { useAuthStore } from "../../stores/auth-store";
import { useOrgStore } from "../../stores/org-store";
import { disconnectSocket } from "../../lib/socket";

/** 로그인/데모 로그인 공용 훅. 성공 시 세션 저장 + 조직 목록 캐시 무효화 후 앱으로 이동. */
export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: (auth) => {
      setAuth(auth);
      void queryClient.invalidateQueries({ queryKey: ["orgs"] });
      navigate("/", { replace: true });
    },
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: registerAccount,
    onSuccess: (auth) => {
      setAuth(auth);
      navigate("/", { replace: true });
    },
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setCurrentOrgId = useOrgStore((s) => s.setCurrentOrgId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return async function logout() {
    const refreshToken = useAuthStore.getState().refreshToken;
    try {
      if (refreshToken) await logoutRequest(refreshToken);
    } catch {
      // 서버 로그아웃 실패해도 클라이언트 세션은 항상 정리한다(토큰이 이미 만료됐을 수 있음).
    }
    clearAuth();
    // 다음 로그인이 다른 사용자일 수 있으므로 이전 조직 선택과 모든 캐시를 함께 비운다.
    setCurrentOrgId(null);
    queryClient.clear();
    // 다음 로그인에서 새 access token으로 다시 연결되도록 소켓도 함께 끊는다.
    disconnectSocket();
    navigate("/login", { replace: true });
  };
}
