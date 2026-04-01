import { useState, useEffect, useRef, useCallback } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { Room, MatrixClient, RoomEvent, MatrixEvent, MsgType } from 'matrix-js-sdk';

// ─── Layout ───────────────────────────────────────────────────────────────────

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  height: 100%;
  overflow: hidden;
  background: ${themeCssVariables.background.primary};
`;

const StyledHeader = styled.header`
  display: flex;
  align-items: center;
  padding: 0 ${themeCssVariables.spacing[5]};
  height: 52px;
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledHeaderName = styled.span`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledTimeline = styled.div`
  flex: 1 1 auto;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[4]} ${themeCssVariables.spacing[5]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

interface StyledMessageBubbleProps {
  isOwn: boolean;
}

const StyledMessageRow = styled.div<StyledMessageBubbleProps>`
  display: flex;
  flex-direction: ${({ isOwn }: StyledMessageBubbleProps) => (isOwn ? 'row-reverse' : 'row')};
  align-items: flex-end;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledAvatar = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${themeCssVariables.background.transparent.medium};
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledBubble = styled.div<StyledMessageBubbleProps>`
  max-width: 60%;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  border-radius: ${({ isOwn }: StyledMessageBubbleProps) =>
    isOwn
      ? `${themeCssVariables.border.radius.md} ${themeCssVariables.border.radius.sm} ${themeCssVariables.border.radius.sm} ${themeCssVariables.border.radius.md}`
      : `${themeCssVariables.border.radius.sm} ${themeCssVariables.border.radius.md} ${themeCssVariables.border.radius.md} ${themeCssVariables.border.radius.sm}`};
  background: ${({ isOwn }: StyledMessageBubbleProps) =>
    isOwn
      ? themeCssVariables.color.blue9
      : themeCssVariables.background.secondary};
  color: ${({ isOwn }: StyledMessageBubbleProps) =>
    isOwn ? '#ffffff' : themeCssVariables.font.color.primary};
`;

const StyledBubbleText = styled.p`
  margin: 0;
  font-size: ${themeCssVariables.font.size.sm};
  font-family: ${themeCssVariables.font.family};
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
`;

const StyledTimestamp = styled.span`
  font-size: 10px;
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.light};
  margin-top: 2px;
  display: block;
  text-align: right;
`;

const StyledComposer = styled.form`
  display: flex;
  align-items: flex-end;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[5]};
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  flex-shrink: 0;
  background: ${themeCssVariables.background.primary};
`;

const StyledTextarea = styled.textarea`
  flex: 1 1 auto;
  resize: none;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  font-size: ${themeCssVariables.font.size.sm};
  font-family: ${themeCssVariables.font.family};
  line-height: 1.5;
  color: ${themeCssVariables.font.color.primary};
  background: ${themeCssVariables.background.secondary};
  min-height: 40px;
  max-height: 120px;
  outline: none;

  &:focus {
    border-color: ${themeCssVariables.color.blue8};
  }

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
  }
`;

const StyledSendButton = styled.button`
  height: 40px;
  padding: 0 ${themeCssVariables.spacing[4]};
  border-radius: ${themeCssVariables.border.radius.md};
  border: none;
  background: ${themeCssVariables.color.blue9};
  color: #ffffff;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  font-family: ${themeCssVariables.font.family};
  cursor: pointer;
  flex-shrink: 0;
  transition: background 80ms ease;

  &:hover {
    background: ${themeCssVariables.color.blue10};
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

type ConversationViewProps = {
  room: Room;
  client: MatrixClient;
};

type MessageItem = {
  eventId: string;
  sender: string;
  body: string;
  timestamp: number;
  isOwn: boolean;
};

export const ConversationView = ({ room, client }: ConversationViewProps) => {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const myUserId = client.getUserId() ?? '';

  const buildMessages = useCallback(() => {
    const events = room.getLiveTimeline().getEvents();
    return events
      .filter((e: MatrixEvent) => e.getType() === 'm.room.message')
      .map((e: MatrixEvent) => ({
        eventId: e.getId() ?? '',
        sender: e.getSender() ?? '',
        body: (e.getContent().body as string) ?? '',
        timestamp: e.getTs(),
        isOwn: e.getSender() === myUserId,
      }));
  }, [room, myUserId]);

  useEffect(() => {
    setMessages(buildMessages());

    const onTimeline = () => setMessages(buildMessages());
    room.on(RoomEvent.Timeline, onTimeline);
    return () => { room.off(RoomEvent.Timeline, onTimeline); };
  }, [room, buildMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || isSending) return;

    setIsSending(true);
    setDraft('');
    try {
      await client.sendMessage(room.roomId, {
        msgtype: MsgType.Text,
        body,
      });
    } catch (err) {
      console.error('[Matrix] Failed to send message:', err);
      setDraft(body); // Restore draft on failure
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as any);
    }
  };

  return (
    <StyledContainer>
      <StyledHeader>
        <StyledHeaderName>{room.name || 'Conversation'}</StyledHeaderName>
      </StyledHeader>

      <StyledTimeline ref={timelineRef}>
        {messages.map((msg) => {
          const initial = msg.sender.charAt(1).toUpperCase();
          const time = new Date(msg.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          return (
            <StyledMessageRow key={msg.eventId} isOwn={msg.isOwn}>
              {!msg.isOwn && <StyledAvatar>{initial}</StyledAvatar>}
              <StyledBubble isOwn={msg.isOwn}>
                <StyledBubbleText>{msg.body}</StyledBubbleText>
                <StyledTimestamp>{time}</StyledTimestamp>
              </StyledBubble>
            </StyledMessageRow>
          );
        })}
      </StyledTimeline>

      <StyledComposer onSubmit={handleSend}>
        <StyledTextarea
          placeholder="Write a message… (Enter to send, Shift+Enter for new line)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <StyledSendButton type="submit" disabled={!draft.trim() || isSending}>
          Send
        </StyledSendButton>
      </StyledComposer>
    </StyledContainer>
  );
};
