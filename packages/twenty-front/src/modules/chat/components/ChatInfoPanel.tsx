import { useState } from 'react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { IconTrash, IconX } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { CHAT_ACCENT_GRADIENT_SOFT } from '@/chat/constants/chatAccentTheme';
import { GradientAvatar } from '@/chat/components/GradientAvatar';
import { type ChatWorkspaceMemberOption } from '@/chat/types/chat-workspace-layout.type';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

const StyledPanel = styled.div`
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border-left: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.secondary};
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[4]} ${themeCssVariables.spacing[4]} 0;
`;

const StyledTitle = styled.span`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledClose = styled.button`
  border: none;
  background: ${themeCssVariables.background.transparent.light};
  width: 32px;
  height: 32px;
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: ${themeCssVariables.font.color.secondary};

  &:hover {
    background: ${themeCssVariables.background.transparent.medium};
  }
`;

const StyledScroll = styled.div`
  flex: 1 1 auto;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[4]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

const StyledHero = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledName = styled.h2`
  margin: 0;
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledMeta = styled.p`
  margin: 0;
  font-size: ${themeCssVariables.font.size.sm};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledDesc = styled.p`
  margin: 0;
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.secondary};
  text-align: left;
`;

const StyledInviteRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledInviteLink = styled.button`
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.color.blue9};
`;

const StyledToggleRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${themeCssVariables.spacing[3]};
  font-size: ${themeCssVariables.font.size.sm};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledTabs = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  flex-wrap: wrap;
`;

const StyledTab = styled.button<{ $active: boolean }>`
  border: 1px solid
    ${({ $active }) =>
      $active
        ? themeCssVariables.border.color.strong
        : themeCssVariables.border.color.medium};
  background: ${({ $active }) =>
    $active ? themeCssVariables.background.transparent.medium : 'transparent'};
  border-radius: ${themeCssVariables.border.radius.pill};
  padding: 4px 10px;
  font-size: 11px;
  font-weight: ${themeCssVariables.font.weight.medium};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
`;

const StyledThumbRow = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  overflow-x: auto;
  padding-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledThumb = styled.div`
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: ${themeCssVariables.border.radius.sm};
  background: ${CHAT_ACCENT_GRADIENT_SOFT};
  border: 1px solid ${themeCssVariables.border.color.medium};
`;

const StyledMemberRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} 0;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
`;

const StyledMemberText = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const StyledMemberName = styled.span`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledMemberRole = styled.span`
  font-size: 11px;
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledBlockLabel = styled.p`
  margin: 0 0 ${themeCssVariables.spacing[2]};
  font-size: ${themeCssVariables.font.size.sm};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledFooter = styled.div`
  padding: ${themeCssVariables.spacing[4]};
  border-top: 1px solid ${themeCssVariables.border.color.medium};
`;

type ChatInfoPanelProps = {
  title: string;
  isGroup: boolean;
  memberCount: number;
  onClose: () => void;
  members: ChatWorkspaceMemberOption[];
};

const MOCK_MEDIA_TABS = ['Photos', 'Videos', 'Files', 'Links'] as const;

export const ChatInfoPanel = ({
  title,
  isGroup,
  memberCount,
  onClose,
  members,
}: ChatInfoPanelProps) => {
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [mediaTab, setMediaTab] =
    useState<(typeof MOCK_MEDIA_TABS)[number]>('Photos');
  const { enqueueInfoSnackBar } = useSnackBar();

  const displayMembers = members.slice(0, 12);

  return (
    <StyledPanel>
      <StyledHeader>
        <StyledTitle>{t`Details`}</StyledTitle>
        <StyledClose type="button" onClick={onClose} aria-label={t`Close`}>
          <IconX size={18} />
        </StyledClose>
      </StyledHeader>
      <StyledScroll>
        <StyledHero>
          <GradientAvatar label={title} size={72} />
          <StyledName>{title}</StyledName>
          <StyledMeta>
            {isGroup
              ? t`${memberCount} members (preview)`
              : t`Direct conversation`}
          </StyledMeta>
        </StyledHero>

        <StyledDesc>
          {isGroup
            ? t`Workspace channel. Shared files and links will appear here when chat history indexing is connected.`
            : t`Messages are delivered in real time. Open on desktop for the full three-column layout.`}
        </StyledDesc>

        <StyledInviteRow>
          <StyledInviteLink
            type="button"
            onClick={() =>
              enqueueInfoSnackBar({
                message: t`Invite flow will use workspace invitations.`,
              })
            }
          >
            + {t`Invite others`}
          </StyledInviteLink>
        </StyledInviteRow>

        <StyledToggleRow>
          <span>{t`Notifications`}</span>
          <input
            type="checkbox"
            checked={notificationsOn}
            onChange={(e) => setNotificationsOn(e.target.checked)}
            aria-label={t`Notifications`}
          />
        </StyledToggleRow>

        <div>
          <StyledBlockLabel>
            {t`Shared media`} · {t`preview`}
          </StyledBlockLabel>
          <StyledTabs>
            {MOCK_MEDIA_TABS.map((tab) => (
              <StyledTab
                key={tab}
                type="button"
                $active={mediaTab === tab}
                onClick={() => setMediaTab(tab)}
              >
                {tab}
              </StyledTab>
            ))}
          </StyledTabs>
          <StyledThumbRow>
            {Array.from({ length: 6 }).map((_, i) => (
              <StyledThumb key={i} />
            ))}
          </StyledThumbRow>
        </div>

        {isGroup && displayMembers.length > 0 && (
          <div>
            <StyledBlockLabel>
              {t`Members`} ({members.length})
            </StyledBlockLabel>
            {displayMembers.map((m) => (
              <StyledMemberRow key={m.userWorkspaceId}>
                <GradientAvatar
                  label={`${m.firstName} ${m.lastName}`.trim() || m.email}
                  size={36}
                />
                <StyledMemberText>
                  <StyledMemberName>
                    {`${m.firstName} ${m.lastName}`.trim() || m.email}
                  </StyledMemberName>
                  <StyledMemberRole>{m.email}</StyledMemberRole>
                </StyledMemberText>
              </StyledMemberRow>
            ))}
          </div>
        )}
      </StyledScroll>
      <StyledFooter>
        <Button
          Icon={IconTrash}
          title={t`Delete & Leave`}
          variant="secondary"
          accent="danger"
          fullWidth
          onClick={() =>
            enqueueInfoSnackBar({
              message: t`Destructive actions are disabled in this preview.`,
            })
          }
        />
      </StyledFooter>
    </StyledPanel>
  );
};
