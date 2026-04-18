/* eslint-disable twenty/no-state-useref -- scroll pinning requires direct DOM refs */
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import {
  MessageType,
  type BaseMessage,
  type FileMessage,
  type UserMessage,
} from '@sendbird/chat/message';
import { type Member } from '@sendbird/chat/groupChannel';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { ChatMessageContent } from '@/chat/components/ChatMessageContent';
import {
  getMessageSenderId,
  messageBody,
} from '@/chat/hooks/useSendbirdChannel';
import { Avatar } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledList = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledRow = styled.div`
  align-items: flex-start;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledRowGroupTop = styled(StyledRow)`
  margin-top: ${themeCssVariables.spacing[3]};
`;

const StyledAvatarSpacer = styled.div`
  height: 24px;
  width: 24px;
  flex-shrink: 0;
`;

const StyledBubble = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const StyledHeader = styled.div`
  align-items: baseline;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledAuthor = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledTime = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledAdminRow = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[4]};
  text-align: center;
`;

const StyledAttachment = styled.a`
  align-items: center;
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  display: inline-flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
  text-decoration: none;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledImageAttachment = styled.img`
  border-radius: ${themeCssVariables.border.radius.sm};
  max-height: 360px;
  max-width: 320px;
  object-fit: cover;
`;

const StyledEmptyState = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex: 1 1 auto;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  justify-content: center;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledTypingRow = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  padding: 0 ${themeCssVariables.spacing[4]} ${themeCssVariables.spacing[2]};
`;

const GROUPING_WINDOW_MS = 5 * 60 * 1000;

const formatTime = (ts: number) => {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const isImageFile = (message: FileMessage) =>
  message.type?.startsWith('image/') === true;

const senderName = (message: BaseMessage) => {
  if (message.messageType === MessageType.USER) {
    return (message as UserMessage).sender?.nickname || 'Unknown';
  }
  if (message.messageType === MessageType.FILE) {
    return (message as FileMessage).sender?.nickname || 'Unknown';
  }
  return 'System';
};

const senderAvatarUrl = (message: BaseMessage): string | null => {
  if (message.messageType === MessageType.USER) {
    return (message as UserMessage).sender?.plainProfileUrl ?? null;
  }
  if (message.messageType === MessageType.FILE) {
    return (message as FileMessage).sender?.plainProfileUrl ?? null;
  }
  return null;
};

type ChatMessageListProps = {
  messages: BaseMessage[];
  typingMembers: Member[];
};

export const ChatMessageList = ({
  messages,
  typingMembers,
}: ChatMessageListProps) => {
  const { t } = useLingui();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastMessageIdRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const latest = messages[messages.length - 1]?.messageId ?? null;
    if (latest !== lastMessageIdRef.current) {
      lastMessageIdRef.current = latest;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  if (messages.length === 0) {
    return (
      <StyledList ref={containerRef}>
        <StyledEmptyState>
          {t`No messages yet — send the first one below.`}
        </StyledEmptyState>
      </StyledList>
    );
  }

  return (
    <StyledList ref={containerRef}>
      {messages.map((message, index) => {
        if (message.messageType === MessageType.ADMIN) {
          return (
            <StyledAdminRow key={message.messageId}>
              {message.message}
            </StyledAdminRow>
          );
        }

        const prev = messages[index - 1];
        const prevSenderId = prev ? getMessageSenderId(prev) : undefined;
        const currentSenderId = getMessageSenderId(message);
        const isNewGroup =
          !prev ||
          prev.messageType === MessageType.ADMIN ||
          prevSenderId !== currentSenderId ||
          message.createdAt - prev.createdAt > GROUPING_WINDOW_MS;

        const Row = isNewGroup ? StyledRowGroupTop : StyledRow;

        return (
          <Row key={message.messageId}>
            {isNewGroup ? (
              <Avatar
                placeholder={senderName(message)}
                avatarUrl={senderAvatarUrl(message)}
                size="md"
              />
            ) : (
              <StyledAvatarSpacer />
            )}
            <StyledBubble>
              {isNewGroup && (
                <StyledHeader>
                  <StyledAuthor>{senderName(message)}</StyledAuthor>
                  <StyledTime>{formatTime(message.createdAt)}</StyledTime>
                </StyledHeader>
              )}
              {message.messageType === MessageType.FILE ? (
                isImageFile(message as FileMessage) ? (
                  <StyledImageAttachment
                    src={
                      (message as FileMessage).thumbnails?.[0]?.plainUrl ||
                      (message as FileMessage).plainUrl
                    }
                    alt={(message as FileMessage).name}
                  />
                ) : (
                  <StyledAttachment
                    href={(message as FileMessage).plainUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {(message as FileMessage).name || 'File'}
                  </StyledAttachment>
                )
              ) : (
                <ChatMessageContent body={messageBody(message)} />
              )}
            </StyledBubble>
          </Row>
        );
      })}

      {typingMembers.length > 0 && (
        <StyledTypingRow>
          {typingMembers.length === 1
            ? t`${typingMembers[0].nickname} is typing…`
            : t`Several people are typing…`}
        </StyledTypingRow>
      )}
    </StyledList>
  );
};
