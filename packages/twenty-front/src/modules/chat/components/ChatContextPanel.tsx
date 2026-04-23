import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { useEffect, useState, type ReactNode } from 'react';

import {
  type ChatWorkspaceLayoutChannel,
  type ChatWorkspaceLayoutDm,
} from '@/chat/types/chat-workspace-layout.type';
import {
  type ChatRosterMember,
  type ChatRosterResponse,
} from '@/chat/types/chat-roster.type';
import { LightIconButton } from 'twenty-ui/input';
import { Avatar, IconLayoutSidebarRightCollapse } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRoot = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.xl};
  box-shadow: ${themeCssVariables.boxShadow.light};
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
`;

const StyledHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledBody = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  flex: 1 1 auto;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  min-height: 0;
  overflow: auto;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledDl = styled.dl`
  display: grid;
  gap: ${themeCssVariables.spacing[2]};
  margin: 0;
`;

const StyledDt = styled.dt`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  margin: 0;
`;

const StyledDd = styled.dd`
  color: ${themeCssVariables.font.color.primary};
  margin: 0;
  word-break: break-word;
`;

const StyledMuted = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const StyledMembersHeading = styled.h3`
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: ${themeCssVariables.spacing[4]} 0 ${themeCssVariables.spacing[2]};
`;

const StyledMemberRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[1]} 0;
`;

const StyledMemberName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  flex: 1 1 auto;
  font-size: ${themeCssVariables.font.size.sm};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledRosterError = styled.div`
  color: ${themeCssVariables.color.red};
  font-size: ${themeCssVariables.font.size.xs};
  margin-top: ${themeCssVariables.spacing[2]};
`;

type Selection =
  | { kind: 'channel'; channel: ChatWorkspaceLayoutChannel }
  | { kind: 'dm'; dm: ChatWorkspaceLayoutDm };

type ChatContextPanelProps = {
  selection: Selection | null;
  authToken: string | null | undefined;
  onClose?: () => void;
  footer?: ReactNode;
};

const displayName = (member: ChatRosterMember) => {
  const name = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  return name.length > 0 ? name : member.userWorkspaceId;
};

export const ChatContextPanel = ({
  selection,
  authToken,
  onClose,
  footer,
}: ChatContextPanelProps) => {
  const { t } = useLingui();
  const [members, setMembers] = useState<ChatRosterMember[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  useEffect(() => {
    if (!selection || !authToken) {
      setMembers([]);
      setRosterError(null);
      setRosterLoading(false);
      return;
    }

    const path =
      selection.kind === 'channel'
        ? `/chat/channels/${selection.channel.id}/roster`
        : `/chat/dm/${selection.dm.id}/roster`;

    const controller = new AbortController();
    setRosterLoading(true);
    setRosterError(null);

    void (async () => {
      try {
        const response = await fetch(path, {
          headers: { Authorization: `Bearer ${authToken}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text.trim() || `HTTP ${response.status}`);
        }
        const data = (await response.json()) as ChatRosterResponse;
        setMembers(Array.isArray(data.members) ? data.members : []);
      } catch (e) {
        if (controller.signal.aborted) {
          return;
        }
        setMembers([]);
        setRosterError(
          e instanceof Error ? e.message : t`Could not load members`,
        );
      } finally {
        if (!controller.signal.aborted) {
          setRosterLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [authToken, selection, t]);

  return (
    <StyledRoot>
      <StyledHeader>
        <StyledTitle>{t`Details`}</StyledTitle>
        {onClose && (
          <LightIconButton
            Icon={IconLayoutSidebarRightCollapse}
            accent="tertiary"
            size="small"
            aria-label={t`Hide details`}
            onClick={onClose}
          />
        )}
      </StyledHeader>
      <StyledBody>
        {!selection ? (
          <StyledMuted>
            {t`Select a conversation to see who is here and basic channel information.`}
          </StyledMuted>
        ) : selection.kind === 'channel' ? (
          <>
            <StyledDl>
              <div>
                <StyledDt>{t`Name`}</StyledDt>
                <StyledDd>
                  {selection.channel.name || selection.channel.slug}
                </StyledDd>
              </div>
              <div>
                <StyledDt>{t`Visibility`}</StyledDt>
                <StyledDd>
                  {selection.channel.visibility === 'private'
                    ? t`Private`
                    : t`Public`}
                </StyledDd>
              </div>
              <div>
                <StyledDt>{t`Permissions`}</StyledDt>
                <StyledDd>
                  {[
                    selection.channel.canRead ? t`Read` : null,
                    selection.channel.canPost ? t`Post` : null,
                    selection.channel.canManage ? t`Manage` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || t`None`}
                </StyledDd>
              </div>
            </StyledDl>
            <StyledMembersHeading>{t`Members`}</StyledMembersHeading>
            {rosterLoading ? (
              <StyledMuted>{t`Loading members…`}</StyledMuted>
            ) : rosterError ? (
              <StyledRosterError>{rosterError}</StyledRosterError>
            ) : members.length === 0 ? (
              <StyledMuted>{t`No members to show.`}</StyledMuted>
            ) : (
              members.map((member) => (
                <StyledMemberRow key={member.userWorkspaceId}>
                  <Avatar
                    avatarUrl={member.avatarUrl}
                    placeholderColorSeed={member.userWorkspaceId}
                    placeholder={member.firstName || '?'}
                    type="rounded"
                    size="md"
                  />
                  <StyledMemberName>{displayName(member)}</StyledMemberName>
                </StyledMemberRow>
              ))
            )}
          </>
        ) : (
          <>
            <StyledDl>
              <div>
                <StyledDt>{t`Title`}</StyledDt>
                <StyledDd>
                  {selection.dm.title?.trim() || t`Direct message`}
                </StyledDd>
              </div>
              <div>
                <StyledDt>{t`Type`}</StyledDt>
                <StyledDd>
                  {selection.dm.kind === 'group'
                    ? t`Group DM`
                    : t`Direct`}
                </StyledDd>
              </div>
            </StyledDl>
            <StyledMembersHeading>{t`People`}</StyledMembersHeading>
            {rosterLoading ? (
              <StyledMuted>{t`Loading members…`}</StyledMuted>
            ) : rosterError ? (
              <StyledRosterError>{rosterError}</StyledRosterError>
            ) : members.length === 0 ? (
              <StyledMuted>{t`No participants to show.`}</StyledMuted>
            ) : (
              members.map((member) => (
                <StyledMemberRow key={member.userWorkspaceId}>
                  <Avatar
                    avatarUrl={member.avatarUrl}
                    placeholderColorSeed={member.userWorkspaceId}
                    placeholder={member.firstName || '?'}
                    type="rounded"
                    size="md"
                  />
                  <StyledMemberName>{displayName(member)}</StyledMemberName>
                </StyledMemberRow>
              ))
            )}
          </>
        )}
        {footer}
      </StyledBody>
    </StyledRoot>
  );
};
