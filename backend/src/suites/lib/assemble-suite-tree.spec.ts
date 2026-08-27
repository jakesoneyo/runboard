import { assembleSuiteTree, type SuiteFlatNode } from './assemble-suite-tree';

describe('assembleSuiteTree', () => {
  it('parentId 없는 노드는 루트, 있는 노드는 부모의 children으로 들어간다', () => {
    const flat: SuiteFlatNode[] = [
      { id: 'root', name: 'Root', position: 0, caseCount: 0, parentId: null },
      {
        id: 'child',
        name: 'Child',
        position: 0,
        caseCount: 2,
        parentId: 'root',
      },
      {
        id: 'grandchild',
        name: 'Grandchild',
        position: 0,
        caseCount: 5,
        parentId: 'child',
      },
    ];

    const tree = assembleSuiteTree(flat);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('root');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('child');
    expect(tree[0].children[0].caseCount).toBe(2);
    expect(tree[0].children[0].children[0].id).toBe('grandchild');
  });

  it('같은 부모 아래 형제는 position 오름차순으로 정렬된다', () => {
    const flat: SuiteFlatNode[] = [
      { id: 'a', name: 'A', position: 2, caseCount: 0, parentId: null },
      { id: 'b', name: 'B', position: 0, caseCount: 0, parentId: null },
      { id: 'c', name: 'C', position: 1, caseCount: 0, parentId: null },
    ];

    const tree = assembleSuiteTree(flat);

    expect(tree.map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });

  it('빈 목록은 빈 트리를 반환한다', () => {
    expect(assembleSuiteTree([])).toEqual([]);
  });
});
