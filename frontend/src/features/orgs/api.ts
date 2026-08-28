import { apiClient } from "../../lib/api-client";
import type { OrgSummary } from "../../types/api";

export async function fetchMyOrganizations(): Promise<OrgSummary[]> {
  const { data } = await apiClient.get<OrgSummary[]>("/orgs");
  return data;
}

export async function createOrganization(payload: {
  name: string;
}): Promise<OrgSummary> {
  const { data } = await apiClient.post("/orgs", payload);
  return data;
}
