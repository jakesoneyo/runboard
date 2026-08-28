import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OrgState {
  /** "현재 조직"(Organization Context) — 조직 스코프 쿼리 키 선두에 항상 이 값을 넣는다(lib/query-keys.ts). */
  currentOrgId: string | null;
  setCurrentOrgId: (orgId: string | null) => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      currentOrgId: null,
      setCurrentOrgId: (orgId) => set({ currentOrgId: orgId }),
    }),
    { name: "runboard-org" }
  )
);
