/**
 * 조직 전체 스위트를 평면 조회(1쿼리)한 결과를 메모리에서 중첩 트리로 조립한다.
 * API.md 4장 GET /orgs/:orgId/suites?tree=true — "쿼리 1회"를 지키기 위해
 * 재귀 쿼리나 자식별 findMany를 절대 쓰지 않는다(suites.service.ts가 이 함수만 호출).
 */
export interface SuiteFlatNode {
  id: string;
  name: string;
  position: number;
  caseCount: number;
  parentId: string | null;
}

export interface SuiteTreeNode {
  id: string;
  name: string;
  position: number;
  caseCount: number;
  children: SuiteTreeNode[];
}

export function assembleSuiteTree(nodes: SuiteFlatNode[]): SuiteTreeNode[] {
  const byId = new Map<string, SuiteTreeNode>(
    nodes.map((n) => [
      n.id,
      {
        id: n.id,
        name: n.name,
        position: n.position,
        caseCount: n.caseCount,
        children: [],
      },
    ]),
  );

  const roots: SuiteTreeNode[] = [];
  for (const n of nodes) {
    const node = byId.get(n.id);
    if (!node) continue;
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    // parent가 없는데 parentId가 있는 경우(이론상 DB 복합 FK가 막아 발생하지 않는다)는
    // 방어적으로 루트 취급한다 — 트리 조립이 죽는 것보다 안전하다.
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  sortByPositionRecursive(roots);
  return roots;
}

function sortByPositionRecursive(nodes: SuiteTreeNode[]): void {
  nodes.sort((a, b) => a.position - b.position);
  for (const node of nodes) sortByPositionRecursive(node.children);
}
