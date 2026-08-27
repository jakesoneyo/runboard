import { randomBytes } from 'node:crypto';

/**
 * 조직 이름에서 slug를 만든다. slug는 unique 컬럼이라 충돌 가능성을 없애기 위해 임의 접미사를 붙인다
 * (표시용 값이 아니라 URL 식별자이므로 사람이 읽기 좋은 유일성보다 충돌 없음이 우선이다).
 */
export function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = randomBytes(3).toString('hex');
  return base ? `${base}-${suffix}` : suffix;
}
