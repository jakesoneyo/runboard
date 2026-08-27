import { diffFields } from './diff';

describe('diffFields', () => {
  it('원시값이 바뀐 필드만 골라낸다', () => {
    const before = { title: 'A', priority: 'LOW' };
    const after = { title: 'A', priority: 'HIGH' };
    expect(diffFields(before, after, ['title', 'priority'])).toEqual({
      priority: ['LOW', 'HIGH'],
    });
  });

  it('allowedFields에 없는 필드는 값이 달라도 담기지 않는다', () => {
    const before = { title: 'A', secret: 'x' };
    const after = { title: 'B', secret: 'y' };
    expect(diffFields(before, after, ['title'])).toEqual({
      title: ['A', 'B'],
    });
  });

  it('내용이 같은 Json 필드는 참조가 달라도 변경으로 잡히지 않는다', () => {
    const before = { steps: [{ order: 1, action: '클릭' }] };
    const after = { steps: [{ order: 1, action: '클릭' }] }; // 값은 같지만 별개 배열 인스턴스
    expect(diffFields(before, after, ['steps'])).toEqual({});
  });

  it('내용이 실제로 바뀐 Json 필드는 before/after를 그대로 담는다', () => {
    const before = { steps: [{ order: 1, action: '클릭' }] };
    const after = { steps: [{ order: 1, action: '더블클릭' }] };
    expect(diffFields(before, after, ['steps'])).toEqual({
      steps: [before.steps, after.steps],
    });
  });
});
