/**
 * 스위트 트리 규칙(최대 깊이·순환 참조)을 검증하는 순수 함수 모음.
 * UBIQUITOUS_LANGUAGE.md/DATA-MODEL.md: TestSuite는 최대 3단계 트리.
 * DB에서 이미 로드한 (id, parentId) 엣지 목록만 받아 동작 — 호출부(suites.service.ts)가
 * "조직 전체 엣지 1회 조회"로 이 함수들을 재사용하게 만들어 N+1(자식별 개별 쿼리)을 피한다.
 */
export interface SuiteEdge {
  id: string;
  parentId: string | null;
}

export const MAX_SUITE_DEPTH = 3;

/**
 * startId부터 루트까지의 조상 체인을 가까운 순으로 반환한다(자기 자신 포함).
 * DB 복합 FK가 순환을 막아주지만, 방어적으로 이미 방문한 id를 만나면 즉시 멈춘다(무한루프 방지).
 */
export function ancestorChain(edges: SuiteEdge[], startId: string): string[] {
  const parentOf = new Map(edges.map((e) => [e.id, e.parentId]));
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | null = startId;
  while (current && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = parentOf.get(current) ?? null;
  }
  return chain;
}

/** parentId 아래에 새 스위트를 붙이면(깊이 = 부모 깊이 + 1) 최대 깊이를 넘는지 검사한다. */
export function exceedsMaxDepth(edges: SuiteEdge[], parentId: string): boolean {
  return ancestorChain(edges, parentId).length >= MAX_SUITE_DEPTH;
}

/** suiteId를 newParentId 밑으로 옮기면, 자기 자신(또는 자기 하위 트리)을 부모로 삼는 순환이 생기는지 검사한다. */
export function createsCycle(
  edges: SuiteEdge[],
  suiteId: string,
  newParentId: string,
): boolean {
  if (suiteId === newParentId) return true;
  return ancestorChain(edges, newParentId).includes(suiteId);
}
