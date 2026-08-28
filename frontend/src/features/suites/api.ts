import { apiClient } from "../../lib/api-client";
import type { SuiteTreeNode } from "../../types/api";
import type { SuiteFormInput } from "../../schemas/suite.schema";

export async function fetchSuiteTree(orgId: string): Promise<SuiteTreeNode[]> {
  const { data } = await apiClient.get<SuiteTreeNode[]>(
    `/orgs/${orgId}/suites`,
    { params: { tree: "true" } }
  );
  return data;
}

export async function createSuite(orgId: string, payload: SuiteFormInput) {
  const { data } = await apiClient.post(`/orgs/${orgId}/suites`, payload);
  return data;
}

export async function updateSuite(
  orgId: string,
  suiteId: string,
  payload: Partial<SuiteFormInput>
) {
  const { data } = await apiClient.patch(
    `/orgs/${orgId}/suites/${suiteId}`,
    payload
  );
  return data;
}

export async function deleteSuite(orgId: string, suiteId: string) {
  await apiClient.delete(`/orgs/${orgId}/suites/${suiteId}`);
}

/** 트리를 셀렉트 옵션용 평면 목록(들여쓰기 depth 포함)으로 펼친다. */
export function flattenSuiteTree(
  nodes: SuiteTreeNode[],
  depth = 0
): { id: string; name: string; depth: number }[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth },
    ...flattenSuiteTree(node.children, depth + 1),
  ]);
}
