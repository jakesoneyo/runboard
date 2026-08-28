import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/auth-store";

/** accessToken이 없으면 로그인 화면으로 돌려보낸다. 실제 인가 경계는 항상 서버(403/404)다. */
export function RequireAuth() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
