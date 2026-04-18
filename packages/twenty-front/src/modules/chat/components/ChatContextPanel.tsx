import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { type ReactNode } from 'react';

import {
  type ChatWorkspaceLayoutChannel,
  type ChatWorkspaceLayoutDm,
} from '@/chat/types/chat-workspace-layout.type';
import { LightIconButton } from 'twenty-ui/input';
import { IconLayoutSidebarRightCollapse } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRoot = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
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
  margin:0;
`;

type Selection =
  | { kind: 'channel'; channel: ChatWorkspaceLayoutChannel }
  | { kind: 'dm'; dm: ChatWorkspaceLayoutDm };

type ChatContextPanelProps = {
  selection: Selection | null;
  onClose?: () => void;
  footer?: ReactNode;
};

export const ChatContextPanel = ({
  selection,
  onClose,
  footer,
}: ChatContextPanelProps) => {
  const { t } = useLingui();

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
            {t`Select a conversation to see channel information, Sendbird link status, and members.`}
          </StyledMuted>
        ) : selection.kind === 'channel' ? (
          <StyledDl>
            <div>
              <StyledDt>{t`Name`}</StyledDt>
              <StyledDd>
                {selection.channel.name || selection.channel.slug}
              </StyledDd>
            </div>
            <div>
              <StyledDt>{t`Slug`}</StyledDt>
              <StyledDd>{selection.channel.slug}</StyledDd>
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
              <StyledDt>{t`Sendbird`}</StyledDt>
              <StyledDd>
                {selection.channel.sendbirdChannelUrl ?? t`Not linked`}
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
        ) : (
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
            <div>
              <StyledDt>{t`Sendbird`}</StyledDt>
              <StyledDd>
                {selection.dm.sendbirdChannelUrl ?? t`Not linked`}
              </StyledDd>
            </div>
          </StyledDl>
        )}
        {footer}
      </StyledBody>
    </StyledRoot>
  );
};
