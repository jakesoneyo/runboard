// CORS 허용 오리진 계산 — REST(main.ts)와 WebSocket(runs.gateway.ts)이 반드시 같은 값을 써야
// 한쪽만 잠그고 한쪽은 열어두는 사고를 막는다. 단일 함수로 합쳐 "출처 하나"로 관리한다.

/**
 * CORS_ORIGINS 환경변수를 파싱해 허용 오리진을 결정한다.
 *
 * 왜 프로덕션에서만 엄격한가: 로컬 개발은 프론트 포트가 수시로 바뀌고 위협 모델도 없어
 * `true`(전체 허용)가 편의를 위해 합리적이다. 반면 프로덕션은 실제 공격 표면이고,
 * `CORS_ORIGINS`가 비어 있다고 조용히 `true`로 떨어지면(과거 버그) 임의 오리진이
 * Authorization 헤더 요청을 그대로 반사받는다. 그래서 프로덕션에서만 값이 비어 있을 때
 * 즉시 throw해 배포/기동 자체를 막는다(fail-fast) — "일단 열어두고 나중에 잠그기"를 방지.
 *
 * @throws {Error} NODE_ENV=production인데 CORS_ORIGINS가 비어 있을 때
 */
export function resolveCorsOrigin(): boolean | string[] {
  const origins =
    process.env.CORS_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  if (process.env.NODE_ENV === 'production') {
    if (origins.length === 0) {
      throw new Error(
        'CORS_ORIGINS 환경변수가 비어 있습니다. 프로덕션에서는 허용할 오리진을 콤마로 구분해 명시해야 합니다.',
      );
    }
    return origins;
  }

  return origins.length > 0 ? origins : true;
}
