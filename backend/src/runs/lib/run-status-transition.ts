// API.md 5장: PLANNED → IN_PROGRESS → COMPLETED, 어디서든 ABORTED 가능, 종료 상태에서 되돌리기 불가.
import type { RunStatus } from '@prisma/client';
import { DomainException } from '../../common/errors/domain-exception';

const TERMINAL_STATUSES: readonly RunStatus[] = ['COMPLETED', 'ABORTED'];

/**
 * @throws DomainException 409 RUN_INVALID_TRANSITION — 종료 상태에서의 재변경, 또는 순서를 건너뛴 전이.
 */
export function assertValidRunTransition(
  current: RunStatus,
  target: RunStatus,
): void {
  if (TERMINAL_STATUSES.includes(current)) {
    throw new DomainException(
      409,
      'RUN_INVALID_TRANSITION',
      '이미 종료된 실행은 상태를 변경할 수 없습니다.',
    );
  }
  const allowed =
    target === 'ABORTED' ||
    (current === 'PLANNED' && target === 'IN_PROGRESS') ||
    (current === 'IN_PROGRESS' && target === 'COMPLETED');
  if (!allowed) {
    throw new DomainException(
      409,
      'RUN_INVALID_TRANSITION',
      `${current}에서 ${target}(으)로 전이할 수 없습니다.`,
    );
  }
}
