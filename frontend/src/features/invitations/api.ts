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
