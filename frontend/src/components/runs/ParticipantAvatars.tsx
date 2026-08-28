import type { RunParticipant } from "../../types/api";

/** variant-c-bold .participants — run:presence.updated로 갱신되는 실시간 접속자 아바타 스택. */
export function ParticipantAvatars({
  participants,
}: {
  participants: RunParticipant[];
}) {
  if (participants.length === 0) return null;

  return (
    <div className="mb-6 flex items-center gap-2">
      <div className="flex">
        {participants.map((p) => (
          <span
            key={p.userId}
            title={p.name}
            className="-ml-2 flex h-[26px] w-[26px] items-center justify-center border-2 border-paper-raised bg-ink text-[10px] font-extrabold text-white first:ml-0"
          >
            {p.name.slice(0, 2).toUpperCase()}
          </span>
        ))}
      </div>
      <span className="text-[11px] text-ink/60">
        {participants.map((p) => p.name).join(", ")} 이 함께 실행 중
      </span>
    </div>
  );
}
