import { useState, type FormEvent } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuthStore } from "../stores/auth-store";
import { useOrgStore } from "../stores/org-store";
import { useCreateOrganization, useCurrentOrg } from "../features/orgs/hooks";
import { useLogout } from "../features/auth/hooks";
import { useOrgRealtime } from "../features/realtime/use-org-realtime";
import { roleAtLeast } from "../lib/roles";
import { RoleBadge } from "../components/RoleBadge";
import { FrameMarks } from "../components/FrameMarks";
import { Toast } from "../components/Toast";
import { Button } from "../components/ui/Button";
import { Field, TextInput } from "../components/ui/Field";
import { getErrorMessage } from "../lib/errors";

const TAB_CLASS =
  "px-3.5 py-2 text-[12px] font-bold tracking-[0.02em] border-[1.5px] border-transparent whitespace-nowrap";

/** variant-c-bold topbar/tabs 구조 — 브랜드 + 탭 + 조직 선택 + 역할 배지를 한 줄에 고정한다. */
export function AppShell() {
  const { orgs, current, isLoading } = useCurrentOrg();
  const setCurrentOrgId = useOrgStore((s) => s.setCurrentOrgId);
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  // 로그인된 동안 소켓을 연결·유지하고 현재 조직 룸에 머문다(조직 전환 시 자동 재조인) —
  // 실행 보드(useRunSocket)와 별개로, org 룸으로 브로드캐스트되는 이벤트(버그 생성/수정)용이다.
  useOrgRealtime();

  return (
    <div className="min-h-dvh">
      <FrameMarks />
      <Toast />

      <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between gap-4 border-b-2 border-ink bg-paper-raised px-6">
        <div className="flex items-center gap-2.5 text-[18px] font-extrabold tracking-[-0.02em] whitespace-nowrap">
          <span className="h-[9px] w-[9px] bg-accent" />
          RUNBOARD
        </div>

        <nav className="flex gap-0.5 overflow-x-auto">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `${TAB_CLASS} ${isActive ? "border-ink bg-ink text-white" : "hover:border-paper-line-strong"}`
            }
          >
            DASHBOARD
          </NavLink>
          <NavLink
            to="/suites"
            className={({ isActive }) =>
              `${TAB_CLASS} ${isActive ? "border-ink bg-ink text-white" : "hover:border-paper-line-strong"}`
            }
          >
            SUITES
          </NavLink>
          <NavLink
            to="/runs"
            className={({ isActive }) =>
              `${TAB_CLASS} ${isActive ? "border-ink bg-ink text-white" : "hover:border-paper-line-strong"}`
            }
          >
            EXEC
          </NavLink>
          <NavLink
            to="/bugs"
            className={({ isActive }) =>
              `${TAB_CLASS} ${isActive ? "border-ink bg-ink text-white" : "hover:border-paper-line-strong"}`
            }
          >
            BUGS
          </NavLink>
          {roleAtLeast(current?.role, "ADMIN") && (
            <NavLink
              to="/audit"
              className={({ isActive }) =>
                `${TAB_CLASS} ${isActive ? "border-ink bg-ink text-white" : "hover:border-paper-line-strong"}`
              }
            >
              AUDIT
            </NavLink>
          )}
          <NavLink
            to="/members"
            className={({ isActive }) =>
              `${TAB_CLASS} ${isActive ? "border-ink bg-ink text-white" : "hover:border-paper-line-strong"}`
            }
          >
            MEMBERS
          </NavLink>
        </nav>

        <div className="flex flex-none items-center gap-2.5">
          {orgs.length > 0 && current && (
            <div className="relative">
              <select
                aria-label="조직 선택"
                value={current.id}
                onChange={(e) => setCurrentOrgId(e.target.value)}
                className="min-w-[180px] appearance-none border-[1.5px] border-ink bg-white px-3 py-2 text-[13px] font-bold"
              >
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {current && (
            <div className="flex items-center gap-2 border-[1.5px] border-ink px-2.5 py-1.5 text-[11px] font-bold">
              <span className="flex h-5 w-5 items-center justify-center bg-accent text-[10px] font-extrabold text-white">
                {user?.name?.slice(0, 2).toUpperCase() ?? "??"}
              </span>
              {user?.name}
              <RoleBadge role={current.role} />
            </div>
          )}
          <Button variant="ghost" onClick={() => void logout()}>
            로그아웃
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1360px] px-6 py-10 pb-24">
        {isLoading ? (
          <p className="text-[13px] text-ink/60">불러오는 중...</p>
        ) : orgs.length === 0 ? (
          <NoOrganizationState />
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}

/** 방금 가입해 아직 소속 조직이 없는 사용자를 빈 화면에 가두지 않기 위한 최소 온보딩 경로. */
function NoOrganizationState() {
  const [name, setName] = useState("");
  const createOrganization = useCreateOrganization();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    createOrganization.mutate({ name: name.trim() });
  }

  return (
    <div className="mx-auto max-w-md border-[1.5px] border-ink bg-paper-raised p-8">
      <h2 className="mb-2 text-[16px] font-extrabold">
        아직 소속된 조직이 없습니다
      </h2>
      <p className="mb-6 text-[12px] text-ink/60">
        새 조직을 만들면 자동으로 그 조직의 ADMIN이 됩니다.
      </p>
      <form onSubmit={handleSubmit}>
        <Field label="조직 이름" htmlFor="new-org-name">
          <TextInput
            id="new-org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 노바리테일"
          />
        </Field>
        {createOrganization.isError && (
          <p className="mb-3 text-[11px] font-bold text-fail">
            {getErrorMessage(createOrganization.error)}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={createOrganization.isPending}
        >
          조직 만들기
        </Button>
      </form>
    </div>
  );
}
