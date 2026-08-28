import { create } from "zustand";

export type ToastTone = "error" | "info";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface UiState {
  toast: Toast | null;
  /**
   * 서버 403(권한 부족)을 포함한 전역 알림 표시 채널.
   * 버튼을 숨기는 것만으로는 부족하다 — 숨김을 우회해 직접 요청을 보내는 경우에도
   * 서버가 진짜로 거부했다는 사실을 사용자가 볼 수 있어야 한다(방어의 마지막 층은 항상 서버).
   */
  showToast: (message: string, tone?: ToastTone) => void;
  dismissToast: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  toast: null,
  showToast: (message, tone = "error") =>
    set({ toast: { id: Date.now(), message, tone } }),
  dismissToast: () => set({ toast: null }),
}));
