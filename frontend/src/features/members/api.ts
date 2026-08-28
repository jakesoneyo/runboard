import { apiClient } from "../../lib/api-client";
import type { Member, Role } from "../../types/api";

export async function fetchMembers(orgId: string): Promise<Member[]> {
  const { data } = await apiClient.get<Member[]>(`/orgs/${orgId}/members`);
  return data;
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: Role
) {
  const { data } = await apiClient.patch(`/orgs/${orgId}/members/${userId}`, {
    role,
  });
  return data;
}

export async function removeMember(orgId: string, userId: string) {
  await apiClient.delete(`/orgs/${orgId}/members/${userId}`);
}
