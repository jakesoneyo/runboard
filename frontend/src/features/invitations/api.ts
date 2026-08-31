import { apiClient } from "../../lib/api-client";
import type { CreatedInvitation, Invitation, Role } from "../../types/api";

export async function fetchInvitations(orgId: string): Promise<Invitation[]> {
  const { data } = await apiClient.get<Invitation[]>(
    `/orgs/${orgId}/invitations`
  );
  return data;
}

export async function createInvitation(
  orgId: string,
  payload: { email: string; role: Role }
): Promise<CreatedInvitation> {
  const { data } = await apiClient.post<CreatedInvitation>(
    `/orgs/${orgId}/invitations`,
    payload
  );
  return data;
}

export async function revokeInvitation(orgId: string, invitationId: string) {
  await apiClient.delete(`/orgs/${orgId}/invitations/${invitationId}`);
}

/**
 * 초대 수락 — 조직 스코프 밖 엔드포인트다(토큰만으로 서버가 조직을 알아낸다, API.md 3장).
 * 404(토큰 무효/타인 이메일)·409(이미 처리·만료)는 axios 에러로 그대로 던져 호출부가 처리한다.
 */
export async function acceptInvitation(
  token: string
): Promise<{ organizationId: string; role: Role }> {
  const { data } = await apiClient.post<{ organizationId: string; role: Role }>(
    "/invitations/accept",
    { token }
  );
  return data;
}
