/**
 * 조직 스코프 리소스(스위트/케이스/멤버/초대 등)의 TanStack Query 키는 반드시 이 헬퍼로만 만든다.
 *
 * 왜: 조직을 전환했는데 쿼리 키가 orgId를 포함하지 않으면, 전환 직후 화면이 이전 조직의
 * 캐시된 데이터를 그대로 보여준다 — 다른 회사(테넌트)의 데이터가 잠깐이라도 노출되는
 * 심각한 버그다. orgId를 항상 키 선두에 고정해 조직마다 캐시 네임스페이스를 분리한다.
 */
export function orgScopedKey(
  orgId: string | null | undefined,
  ...rest: readonly unknown[]
) {
  return ["orgs", orgId ?? "no-org", ...rest] as const;
}
