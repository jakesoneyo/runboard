import { useEffect, useRef } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAcceptInvitation } from "../features/invitations/hooks";
import { useAuthStore } from "../stores/auth-store";
import { useOrgStore } from "../stores/org-store";
import { useUiStore } from "../stores/ui-store";
import { getErrorMessage } from "../lib/errors";

/**
 * 초대 링크(`${FRONTEND_URL}/invitations/accept?token=...`, invitations.service.ts:148-151)의
 * 실제 착지점. RequireAuth 바깥의 독립 라우트다 — 미로그인 상태를 이 페이지가 직접 판단해
 * 토큰을 실은 채로 로그인 화면으로 보내고(useLogin/useRegister가 로그인 후 다시 여기로 데려온다),
 * 로그인된 상태면 즉시 수락 API를 호출한다.
 */
export function InvitationAcceptPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const accessToken = useAuthStore((s) => s.accessToken);
  const setCurrentOrgId = useOrgStore((s) => s.setCurrentOrgId);
  const showToast = useUiStore((s) => s.showToast);
  const navigate = useNavigate();
  const acceptInvitation = useAcceptInvitation();
  // 초대 수락은 멱등하지 않다(두 번째 호출은 409) — StrictMode 이중 실행/재렌더에도 한 번만 부른다.
  const attempted = useRef(false);

  useEffect(() => {
    if (!accessToken || !token || attempted.current) return;
    attempted.current = true;
    acceptInvitation.mutate(token, {
      onSuccess: ({ organizationId }) => {
        setCurrentOrgId(organizationId);
        showToast("초대를 수락했습니다. 조직에 합류했습니다.", "info");
        navigate("/dashboard", { replace: true });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- attempted ref로 1회 실행만 보장하면 충분
  }, [accessToken, token]);

  if (!token) {
    return <CenteredMessage title="유효하지 않은 초대 링크입니다." />;
  }

  if (!accessToken) {
    const redirect = encodeURIComponent(`/invitations/accept?token=${token}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  if (acceptInvitation.isError) {
    return (
      <CenteredMessage
        title="초대를 수락하지 못했습니다."
        detail={getErrorMessage(acceptInvitation.error)}
      />
    );
  }

  return <CenteredMessage title="초대를 확인하는 중입니다..." />;
}

function CenteredMessage({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-[15px] font-extrabold">{title}</p>
      {detail && <p className="text-[12.5px] text-ink/60">{detail}</p>}
    </div>
  );
}
