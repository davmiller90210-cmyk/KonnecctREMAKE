import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';

import { ChatMessageContent } from '@/chat/components/ChatMessageContent';
import { ChatMessageActionsDropdownContent } from '@/chat/ui/thread/ChatMessageActionsDropdownContent';
import { ChatMessageReactionsRow } from '@/chat/ui/thread/ChatMessageReactionsRow';
import { NATIVE_CHAT_OPTIMISTIC_ID_PREFIX } from '@/chat/hooks/useNativeChatChannel';
import {
  type NativeChatCrmMentionSnapshot,
  type NativeChatReactionSummary,
} from '@/chat/types/native-chat-message.type';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { Avatar, IconDotsVertical } from 'twenty-ui/display';
import { LightIconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRow = styled.div<{ $own: boolean; $groupStart: boolean }>`
  display: flex;
  flex-direction: ${({ $own }) => ($own ? 'row-reverse' : 'row')};
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${({ $groupStart }) =>
    $groupStart ? themeCssVariables.spacing[3] : '2px'};
  max-width: 100%;
`;

const StyledAvatarSlot = styled.div`
  flex-shrink: 0;
  padding-top: 2px;
  width: 36px;
`;

const StyledAvatarSpacer = styled.div`
  flex-shrink: 0;
  width: 36px;
`;

const StyledCluster = styled.div<{ $own: boolean }>`
  align-items: ${({ $own }) => ($own ? 'flex-end' : 'flex-start')};
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;
  max-width: min(720px, 100%);
  min-width: 0;
`;

const StyledMeta = styled.div<{ $own: boolean }>`
  align-items: baseline;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex-direction: ${({ $own }) => ($own ? 'row-reverse' : 'row')};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  gap: ${themeCssVariables.spacing[2]};
  padding: 0 ${themeCssVariables.spacing[1]};
  width: 100%;
`;

const StyledMetaMain = styled.div<{ $own: boolean }>`
  align-items: baseline;
  display: flex;
  flex: 1 1 auto;
  flex-direction: ${({ $own }) => ($own ? 'row-reverse' : 'row')};
  gap: ${themeCssVariables.spacing[2]};
  min-width: 0;
`;

const StyledAuthor = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledBubbleWrap = styled.div<{ $own: boolean }>`
  position: relative;
  align-self: ${({ $own }) => ($own ? 'flex-end' : 'flex-start')};
  max-width: 100%;
`;

const StyledBubble = styled.div<{
  $own: boolean;
  $pulse: boolean;
}>`
  background: ${({ $own }) =>
    $own
      ? themeCssVariables.background.transparent.blue
      : themeCssVariables.background.secondary};
  border: 1px solid
    ${({ $own }) =>
      $own
        ? themeCssVariables.border.color.blue
        : themeCssVariables.border.color.light};
  border-radius: ${({ $own }) =>
    $own
      ? `${themeCssVariables.border.radius.md} ${themeCssVariables.border.radius.md} ${themeCssVariables.border.radius.xs} ${themeCssVariables.border.radius.md}`
      : `${themeCssVariables.border.radius.md} ${themeCssVariables.border.radius.md} ${themeCssVariables.border.radius.md} ${themeCssVariables.border.radius.xs}`};
  box-shadow: ${themeCssVariables.boxShadow.light};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  animation: ${({ $pulse }) => ($pulse ? 'chat-send-pulse 0.45s ease-out 1' : 'none')};

  @keyframes chat-send-pulse {
    0% {
      transform: scale(1);
    }
    40% {
      transform: scale(1.02);
    }
    100% {
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none !important;
  }
`;

const StyledBubbleActions = styled.div<{ $own: boolean }>`
  position: absolute;
  top: -6px;
  ${({ $own }) => ($own ? 'left: 0;' : 'right: 0;')}
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.12s ease-out;

  ${StyledBubbleWrap}:hover & {
    opacity: 1;
  }

  @media (hover: none) {
    opacity: 1;
  }
`;

const StyledReadReceipt = styled.div<{ $own: boolean }>`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xxs};
  font-style: italic;
  padding: 0 ${themeCssVariables.spacing[1]};
  text-align: ${({ $own }) => ($own ? 'right' : 'left')};
`;

const StyledDeletedNotice = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-style: italic;
`;

type ChatMessageClusterProps = {
  messageId: string;
  isOwn: boolean;
  isGroupStart: boolean;
  showAvatar: boolean;
  showHeader: boolean;
  authorLabel: string;
  timeLabel: string;
  avatarUrl: string | null;
  body: string;
  crmMentionSnapshots?: NativeChatCrmMentionSnapshot[];
  readReceipt: string | null;
  reactions?: NativeChatReactionSummary[];
  isPinned?: boolean;
  highlightSend?: boolean;
  canPin?: boolean;
  onToggleReaction?: (emoji: string, remove: boolean) => void;
  /** When set with `canPin`, “Pin” appears in the message menu. */
  onPin?: () => Promise<void>;
  onUnpin?: () => Promise<void>;
  isDeleted?: boolean;
  isEdited?: boolean;
  onEditMessage?: () => void;
  onDeleteMessage?: () => void;
};

export const ChatMessageCluster = ({
  messageId,
  isOwn,
  isGroupStart,
  showAvatar,
  showHeader,
  authorLabel,
  timeLabel,
  avatarUrl,
  body,
  crmMentionSnapshots,
  readReceipt,
  reactions,
  isPinned,
  highlightSend,
  onToggleReaction,
  canPin = false,
  onPin,
  onUnpin,
  isDeleted = false,
  isEdited = false,
  onEditMessage,
  onDeleteMessage,
}: ChatMessageClusterProps) => {
  const { t } = useLingui();
  const isOptimistic = messageId.startsWith(NATIVE_CHAT_OPTIMISTIC_ID_PREFIX);
  const showMessageMenu = !isOptimistic;
  const dropdownId = `chat-message-actions-${messageId}`;
  const showCopy = Boolean(body.trim()) && !isDeleted;

  return (
    <StyledRow
      id={`chat-msg-${messageId}`}
      $own={isOwn}
      $groupStart={isGroupStart}
    >
      {showAvatar ? (
        <StyledAvatarSlot>
          <Avatar
            placeholder={authorLabel}
            avatarUrl={avatarUrl}
            size="md"
          />
        </StyledAvatarSlot>
      ) : (
        <StyledAvatarSpacer aria-hidden />
      )}
      <StyledCluster $own={isOwn}>
        {showHeader ? (
          <StyledMeta $own={isOwn}>
            <StyledMetaMain $own={isOwn}>
              <StyledAuthor>{authorLabel}</StyledAuthor>
              <span>
                {timeLabel}
                {isEdited ? ` · ${t`edited`}` : ''}
              </span>
            </StyledMetaMain>
          </StyledMeta>
        ) : null}
        <StyledBubbleWrap $own={isOwn}>
          <StyledBubbleActions $own={isOwn} onClick={(e) => e.stopPropagation()}>
            {showMessageMenu ? (
              <Dropdown
                dropdownId={dropdownId}
                dropdownPlacement={isOwn ? 'bottom-start' : 'bottom-end'}
                clickableComponent={
                  <LightIconButton
                    Icon={IconDotsVertical}
                    accent="tertiary"
                    size="small"
                    aria-label={t`Message actions`}
                  />
                }
                dropdownComponents={
                  <ChatMessageActionsDropdownContent
                    textToCopy={body}
                    showCopy={showCopy}
                    isPinned={Boolean(isPinned)}
                    canPin={canPin}
                    onPin={onPin}
                    onUnpin={onUnpin}
                    onEdit={onEditMessage}
                    onDelete={onDeleteMessage}
                  />
                }
              />
            ) : null}
          </StyledBubbleActions>
          <StyledBubble $own={isOwn} $pulse={Boolean(highlightSend)}>
            {isDeleted ? (
              <StyledDeletedNotice>
                {t`This message was deleted.`}
              </StyledDeletedNotice>
            ) : (
              <ChatMessageContent
                body={body}
                crmMentionSnapshots={crmMentionSnapshots}
              />
            )}
          </StyledBubble>
        </StyledBubbleWrap>
        {onToggleReaction && !isDeleted ? (
          <ChatMessageReactionsRow
            isOwn={isOwn}
            reactions={reactions}
            disabled={isOptimistic}
            onToggle={onToggleReaction}
          />
        ) : null}
        {readReceipt ? (
          <StyledReadReceipt $own={isOwn}>{readReceipt}</StyledReadReceipt>
        ) : null}
      </StyledCluster>
    </StyledRow>
  );
};
