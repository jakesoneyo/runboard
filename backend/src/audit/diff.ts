/**
 * before/after 객체에서 실제로 값이 바뀐 필드만 뽑아 `{ field: [before, after] }` 형태로 만든다.
 * 감사로그 metadata는 "무엇이 바뀌었는지"만 남기고 민감정보 전체 덤프를 하지 않기 위한 헬퍼.
 * @param allowedFields 화이트리스트 — 여기 없는 필드는 값이 달라도 절대 metadata에 담기지 않는다.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  allowedFields: readonly (keyof T)[],
): Record<string, [unknown, unknown]> {
  const changed: Record<string, [unknown, unknown]> = {};
  for (const field of allowedFields) {
    const prev = before[field];
    const next = after[field];
    if (prev !== next) {
      changed[field as string] = [prev, next];
    }
  }
  return changed;
}
