// N+1 회귀 증명용 헬퍼. PrismaService가 `log: [{emit:'event', level:'query'}]`로 열어둔 이벤트를
// 구독해 실제 SQL 왕복 수를 센다. tenant.extension.ts의 $extends는 같은 엔진 인스턴스를 감쌀 뿐이라
// 이 리스너는 TENANT_PRISMA를 통한 쿼리도 그대로 잡아낸다.
import type { PrismaService } from '../../src/prisma/prisma.service';

export interface QueryCounter {
  reset(): void;
  readonly count: number;
}

export function attachQueryCounter(prisma: PrismaService): QueryCounter {
  let count = 0;
  prisma.$on('query', () => {
    count += 1;
  });
  return {
    reset: () => {
      count = 0;
    },
    get count() {
      return count;
    },
  };
}
