import {
  ancestorChain,
  createsCycle,
  exceedsMaxDepth,
  type SuiteEdge,
} from './suite-tree-rules';

// root(depth1) -> child(depth2) -> grandchild(depth3)
const edges: SuiteEdge[] = [
  { id: 'root', parentId: null },
  { id: 'child', parentId: 'root' },
  { id: 'grandchild', parentId: 'child' },
  { id: 'other-root', parentId: null },
];

describe('ancestorChain', () => {
  it('가까운 조상부터 루트까지 순서대로 반환한다', () => {
    expect(ancestorChain(edges, 'grandchild')).toEqual([
      'grandchild',
      'child',
      'root',
    ]);
  });

  it('루트는 자기 자신만 담긴다', () => {
    expect(ancestorChain(edges, 'root')).toEqual(['root']);
  });
});

describe('exceedsMaxDepth', () => {
  it('root(depth1) 밑에 자식(depth2)을 붙이는 것은 허용', () => {
    expect(exceedsMaxDepth(edges, 'root')).toBe(false);
  });

  it('child(depth2) 밑에 자식(depth3)을 붙이는 것은 허용', () => {
    expect(exceedsMaxDepth(edges, 'child')).toBe(false);
  });

  it('grandchild(depth3) 밑에 4번째 단계를 붙이는 것은 거부', () => {
    expect(exceedsMaxDepth(edges, 'grandchild')).toBe(true);
  });
});

describe('createsCycle', () => {
  it('자기 자신을 부모로 지정하면 순환', () => {
    expect(createsCycle(edges, 'child', 'child')).toBe(true);
  });

  it('자기 하위 트리(손자)를 부모로 지정하면 순환', () => {
    expect(createsCycle(edges, 'child', 'grandchild')).toBe(true);
  });

  it('무관한 다른 트리로 옮기는 것은 순환이 아니다', () => {
    expect(createsCycle(edges, 'child', 'other-root')).toBe(false);
  });

  it('자기 부모로 다시 옮기는 것(변경 없음과 동일)도 순환이 아니다', () => {
    expect(createsCycle(edges, 'grandchild', 'root')).toBe(false);
  });
});
