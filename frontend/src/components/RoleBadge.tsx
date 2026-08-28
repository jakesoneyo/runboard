import type { Role } from "../types/api";
import { Badge } from "./ui/Badge";

/** invert: is-you 카드처럼 어두운 배경 위에 올릴 때 — 반드시 tone 자체를 바꾼다(Badge 주석 참고). */
export function RoleBadge({
  role,
  invert = false,
}: {
  role: Role;
  invert?: boolean;
}) {
  return <Badge tone={invert ? "role-inverted" : "role"}>{role}</Badge>;
}
