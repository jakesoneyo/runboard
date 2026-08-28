import { useState, type FormEvent } from "react";
import { useCurrentOrg } from "../features/orgs/hooks";
import {
  useMembers,
  useRemoveMember,
  useUpdateMemberRole,
} from "../features/members/hooks";
import {
  useCreateInvitation,
  useInvitations,
  useRevokeInvitation,
} from "../features/invitations/hooks";
import { useAuthStore } from "../stores/auth-store";
import { useUiStore } from "../stores/ui-store";
import { roleAtLeast } from "../lib/roles";
import { getErrorMessage } from "../lib/errors";
import type { Role } from "../types/api";
import { Panel, PanelLabel } from "../components/ui/Panel";
import { Button } from "../components/ui/Button";
import { Field, Select, TextInput } from "../components/ui/Field";
import { RoleBadge } from "../components/RoleBadge";

const ROLE_OPTIONS: Role[] = ["ADMIN", "QA_LEAD", "TESTER", "VIEWER"];

/**
 * API.md 3장 — 멤버 목록은 모든 조직 구성원이 볼 수 있지만, 역할 변경/제거/초대는 ADMIN 전용이다.
 * isAdmin이 아니면 해당 UI를 아예 렌더링하지 않는다(그래도 서버는 항상 403으로 한 번 더 막는다).
 */
export function MembersPage() {
  const { current } = useCurrentOrg();
  const isAdmin = roleAtLeast(current?.role, "ADMIN");

  return (
    <div className="flex flex-col gap-10">
      <section>
        <PanelLabel>MEMBERS</PanelLabel>
        <MembersGrid isAdmin={isAdmin} />
      </section>

      {isAdmin && (
        <section>
          <PanelLabel>INVITATIONS</PanelLabel>
          <InvitationsPanel />
        </section>
      )}
    </div>
  );
}

function MembersGrid({ isAdmin }: { isAdmin: boolean }) {
  const { data: members = [], isLoading } = useMembers();
  const userId = useAuthStore((s) => s.user?.id);
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const showToast = useUiStore((s) => s.showToast);

  if (isLoading) {
    return <p className="text-[12.5px] text-ink/60">불러오는 중...</p>;
  }

  function handleRemove(targetUserId: string, name: string) {
    const confirmed = window.confirm(`${name}님을 조직에서 제거할까요?`);
    if (!confirmed) return;
    removeMember.mutate(targetUserId, {
      onError: (error) => showToast(getErrorMessage(error)),
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {members.map((member) => {
        const isYou = member.userId === userId;
        return (
          <Panel
            key={member.userId}
            className={isYou ? "bg-ink text-white" : "bg-paper-raised"}
          >
            <div className="mb-1 text-[15px] font-extrabold">{member.name}</div>
            <div
              className={`mb-3.5 text-[11px] ${isYou ? "text-paper/60" : "text-ink/50"}`}
            >
              {member.email}
            </div>
            {isAdmin ? (
              <div className="flex items-center gap-2">
                <Select
                  aria-label={`${member.name} 역할`}
                  value={member.role}
                  onChange={(e) =>
                    updateRole.mutate(
                      { userId: member.userId, role: e.target.value as Role },
                      { onError: (error) => showToast(getErrorMessage(error)) }
                    )
                  }
                  className="!w-auto bg-white py-1.5 text-ink"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={() => handleRemove(member.userId, member.name)}
                  className={`text-[11px] font-bold underline ${isYou ? "text-fail-tint" : "text-fail"}`}
                >
                  제거
                </button>
              </div>
            ) : (
              <RoleBadge role={member.role} invert={isYou} />
            )}
          </Panel>
        );
      })}
    </div>
  );
}

function InvitationsPanel() {
  const { data: invitations = [], isLoading } = useInvitations();
  const createInvitation = useCreateInvitation();
  const revokeInvitation = useRevokeInvitation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("TESTER");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createInvitation.mutate(
      { email, role },
      {
        onSuccess: (created) => {
          setEmail("");
          setInviteUrl(created.inviteUrl);
        },
      }
    );
  }

  return (
    <Panel className="bg-paper-raised">
      <form
        onSubmit={handleSubmit}
        className="mb-6 flex flex-wrap items-end gap-3"
      >
        <Field label="이메일" htmlFor="invite-email">
          <TextInput
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-[220px]"
          />
        </Field>
        <Field label="역할" htmlFor="invite-role">
          <Select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          type="submit"
          variant="accent"
          disabled={createInvitation.isPending}
        >
          초대 생성
        </Button>
      </form>

      {createInvitation.isError && (
        <p className="mb-3 text-[11px] font-bold text-fail">
          {getErrorMessage(createInvitation.error)}
        </p>
      )}
      {inviteUrl && (
        <p className="mb-4 border-[1.5px] border-accent-ink bg-accent-tint px-3 py-2 text-[11px] break-all text-accent-ink">
          메일 발송은 없음 — 링크를 복사해 전달하세요: {inviteUrl}
        </p>
      )}

      {isLoading ? (
        <p className="text-[12.5px] text-ink/60">불러오는 중...</p>
      ) : invitations.length === 0 ? (
        <p className="text-[12.5px] text-ink/60">대기 중인 초대가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between gap-3 border-b border-paper-line py-2.5 text-[12.5px] last:border-b-0"
            >
              <span className="min-w-0 flex-1 truncate">
                {invitation.email}
              </span>
              <RoleBadge role={invitation.role} />
              <span className="w-20 flex-none text-[10.5px] font-bold text-ink/50">
                {invitation.status}
              </span>
              {invitation.status === "PENDING" && (
                <button
                  type="button"
                  onClick={() => revokeInvitation.mutate(invitation.id)}
                  className="text-[11px] font-bold text-fail underline"
                >
                  폐기
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
