import type { ReactNode } from "react";
import { X } from "lucide-react";

/** 케이스 생성/편집 등에 재사용하는 각진 모달 셸. 바깥 클릭·ESC로는 닫지 않는다(폼 작성 중 실수 방지). */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-6 md:items-center">
      <div className="w-full max-w-2xl border-2 border-ink bg-paper-raised">
        <div className="flex items-center justify-between border-b-[1.5px] border-ink px-6 py-4">
          <h2 className="text-[15px] font-extrabold">{title}</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="text-ink/60 hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
