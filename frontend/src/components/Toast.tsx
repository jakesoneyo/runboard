import { useEffect } from "react";
import { useUiStore } from "../stores/ui-store";

/**
 * 서버 403 등 전역 알림을 화면 우하단에 잠깐 띄운다.
 * 역할 게이팅으로 버튼을 숨겨도 우회 요청은 가능하므로, 서버가 실제로 거부했다는 사실이
 * 항상 사용자 눈에 보이게 하는 마지막 방어선이다(axios 인터셉터가 이 스토어를 채운다).
 */
export function Toast() {
  const toast = useUiStore((s) => s.toast);
  const dismissToast = useUiStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismissToast, 4000);
    return () => window.clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;

  const toneClass =
    toast.tone === "error"
      ? "border-fail bg-fail-tint text-fail"
      : "border-accent-ink bg-accent-tint text-accent-ink";

  return (
    <div
      className={`fixed right-6 bottom-6 z-[100] max-w-sm border-[1.5px] px-4 py-3 text-[12.5px] font-semibold shadow-lg ${toneClass}`}
    >
      {toast.message}
    </div>
  );
}
