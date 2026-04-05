import { useState, useRef, useEffect, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { styled } from '@linaria/react';
import TextareaAutosize from 'react-textarea-autosize';
import {
  IconPaperclip,
  IconPlayerPlay,
  IconPlayerStop,
  IconSend,
} from 'twenty-ui/display';
import { IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import {
  type ChatConversation,
  currentMessagesAtom,
  type ChatMessage,
} from '@/chat/states/agoraSessionState';
import { requestChatNotificationPermission } from '@/chat/utils/chat-desktop-notify';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  background: ${themeCssVariables.background.primary};
`;

const StyledHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${themeCssVariables.spacing[5]};
  min-height: 56px;
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[3]};
  background: ${themeCssVariables.background.secondary};
`;

const StyledHeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const StyledHeaderName = styled.span`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledHeaderMeta = styled.span`
  font-size: ${themeCssVariables.font.size.xs};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledNotifyLink = styled.button`
  border: none;
  background: transparent;
  font-size: ${themeCssVariables.font.size.xs};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.color.blue9};
  cursor: pointer;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  flex-shrink: 0;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledTimeline = styled.div`
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: ${themeCssVariables.spacing[5]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  background: linear-gradient(
    180deg,
    ${themeCssVariables.background.primary} 0%,
    ${themeCssVariables.background.secondary} 100%
  );
`;

const StyledDayDivider = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[3]};
  margin: ${themeCssVariables.spacing[4]} 0;
  font-size: 11px;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${themeCssVariables.border.color.medium};
  }
`;

interface StyledMessageBubbleProps {
  isOwn: boolean;
}

const StyledMessageRow = styled.div<StyledMessageBubbleProps>`
  display: flex;
  flex-direction: ${({ isOwn }) => (isOwn ? 'row-reverse' : 'row')};
  align-items: flex-end;
  gap: ${themeCssVariables.spacing[2]};
  max-width: 100%;
`;

const StyledAvatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${themeCssVariables.background.transparent.medium};
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
`;

const StyledBubble = styled.div<StyledMessageBubbleProps>`
  max-width: min(72%, 520px);
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
  border-radius: ${({ isOwn }) =>
    isOwn
      ? `${themeCssVariables.border.radius.xl} ${themeCssVariables.border.radius.sm} ${themeCssVariables.border.radius.xl} ${themeCssVariables.border.radius.xl}`
      : `${themeCssVariables.border.radius.sm} ${themeCssVariables.border.radius.xl} ${themeCssVariables.border.radius.xl} ${themeCssVariables.border.radius.xl}`};
  background: ${({ isOwn }) =>
    isOwn
      ? themeCssVariables.color.blue9
      : themeCssVariables.background.primary};
  color: ${({ isOwn }) =>
    isOwn ? '#ffffff' : themeCssVariables.font.color.primary};
  border: ${({ isOwn }) =>
    isOwn ? 'none' : `1px solid ${themeCssVariables.border.color.medium}`};
  box-shadow: ${({ isOwn }) =>
    isOwn
      ? '0 1px 2px rgba(15, 23, 42, 0.08)'
      : '0 1px 2px rgba(15, 23, 42, 0.06)'};
`;

const StyledBubbleText = styled.p`
  margin: 0;
  font-size: ${themeCssVariables.font.size.sm};
  font-family: ${themeCssVariables.font.family};
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
`;

const StyledSenderLabel = styled.div`
  font-size: 11px;
  font-weight: ${themeCssVariables.font.weight.medium};
  font-family: ${themeCssVariables.font.family};
  opacity: 0.9;
  margin-bottom: 4px;
`;

const StyledImageAttachment = styled.img`
  max-width: 100%;
  border-radius: ${themeCssVariables.border.radius.sm};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledAudio = styled.audio`
  max-width: 240px;
  outline: none;
`;

const StyledVideo = styled.video`
  max-width: 100%;
  border-radius: ${themeCssVariables.border.radius.md};
`;

const StyledRecordingBanner = styled.div`
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[1]};
  color: ${themeCssVariables.color.red5};
  font-size: ${themeCssVariables.font.size.sm};
  font-family: ${themeCssVariables.font.family};
`;

const StyledTimestamp = styled.span<{ $isOwn?: boolean }>`
  font-size: 10px;
  font-family: ${themeCssVariables.font.family};
  margin-top: 4px;
  display: block;
  text-align: right;
  opacity: 0.88;
  color: ${({ $isOwn }) =>
    $isOwn ? 'rgba(255, 255, 255, 0.9)' : themeCssVariables.font.color.light};
`;

const StyledComposerWrap = styled.div`
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[5]}
    ${themeCssVariables.spacing[4]};
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  flex-shrink: 0;
  background: ${themeCssVariables.background.secondary};
`;

const StyledComposer = styled.form`
  display: flex;
  align-items: flex-end;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[2]}
    ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  border-radius: ${themeCssVariables.border.radius.xl};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.primary};
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
`;

const StyledTextarea = styled(TextareaAutosize)`
  flex: 1 1 auto;
  resize: none;
  border: none;
  padding: ${themeCssVariables.spacing[2]} 0;
  font-size: ${themeCssVariables.font.size.sm};
  font-family: ${themeCssVariables.font.family};
  line-height: 1.5;
  color: ${themeCssVariables.font.color.primary};
  background: transparent;
  min-height: 24px;
  max-height: 160px;
  outline: none;
  width: 100%;

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
  }
`;

const StyledToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding-bottom: 2px;
`;

const StyledHiddenInput = styled.input`
  display: none;
`;

const StyledEmptyState = styled.div`
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  font-family: ${themeCssVariables.font.family};
  text-align: center;
  padding: ${themeCssVariables.spacing[8]};
`;

type ConversationViewProps = {
  conversation: ChatConversation;
  onSendMessage: (text: string) => void;
  onSendAttachment: (
    file: File,
    type: 'img' | 'file' | 'audio' | 'video',
  ) => void;
};

type TimelineEntry =
  | { kind: 'day'; label: string }
  | { kind: 'msg'; message: ChatMessage };

const dayLabel = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);

  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year:
      d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
};

export const ConversationView = ({
  conversation,
  onSendMessage,
  onSendAttachment,
}: ConversationViewProps) => {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const allMessagesMap = useAtomValue(currentMessagesAtom);
  const messages = allMessagesMap[conversation.id] || [];

  const timelineRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const timelineEntries = useMemo((): TimelineEntry[] => {
    const entries: TimelineEntry[] = [];
    let lastDay = '';

    for (const msg of messages) {
      const dk = new Date(msg.createdAt).toDateString();

      if (dk !== lastDay) {
        lastDay = dk;
        entries.push({ kind: 'day', label: dayLabel(msg.createdAt) });
      }
      entries.push({ kind: 'msg', message: msg });
    }

    return entries;
  }, [messages]);

  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [messages, timelineEntries.length]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = draft.trim();

    if (!body || isSending) {
      return;
    }

    setIsSending(true);
    setDraft('');
    onSendMessage(body);
    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    const type = file.type.startsWith('image/')
      ? 'img'
      : file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
          ? 'audio'
          : 'file';

    onSendAttachment(file, type);
    e.target.value = '';
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm',
        });
        const file = new File(
          [audioBlob],
          `Voice_Note_${Date.now()}.webm`,
          { type: 'audio/webm' },
        );

        onSendAttachment(file, 'audio');
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied or unavailable', err);
      enqueueErrorSnackBar({
        message: 'Microphone access is required for voice notes.',
      });
    }
  };

  const handleNotifyClick = async () => {
    const result = await requestChatNotificationPermission();

    if (result === 'granted') {
      enqueueSuccessSnackBar({ message: 'Desktop notifications enabled.' });
    } else if (result === 'denied') {
      enqueueErrorSnackBar({
        message: 'Notifications are blocked for this site in the browser.',
      });
    }
  };

  const channelKind =
    conversation.type === 'groupChat' ? 'Channel' : 'Direct message';

  return (
    <StyledContainer>
      <StyledHeader>
        <StyledHeaderLeft>
          <StyledHeaderName>
            {conversation.name || 'Conversation'}
          </StyledHeaderName>
          <StyledHeaderMeta>{channelKind}</StyledHeaderMeta>
        </StyledHeaderLeft>
        {typeof Notification !== 'undefined' &&
          Notification.permission !== 'granted' && (
            <StyledNotifyLink type="button" onClick={handleNotifyClick}>
              Enable desktop alerts
            </StyledNotifyLink>
          )}
      </StyledHeader>

      <StyledTimeline ref={timelineRef}>
        {messages.length === 0 ? (
          <StyledEmptyState>
            No messages yet.
            <br />
            Say hello — history loads from the server when available.
          </StyledEmptyState>
        ) : (
          timelineEntries.map((entry, index) => {
            if (entry.kind === 'day') {
              return <StyledDayDivider key={`day-${entry.label}-${index}`}>{entry.label}</StyledDayDivider>;
            }

            const msg = entry.message;
            const isOwn = msg.direction === 'out';
            const initial = msg.senderName
              ? msg.senderName.charAt(0).toUpperCase()
              : msg.senderId.charAt(0).toUpperCase();
            const time = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <StyledMessageRow key={msg.id} isOwn={isOwn}>
                {!isOwn && <StyledAvatar>{initial}</StyledAvatar>}

                <StyledBubble isOwn={isOwn}>
                  {!isOwn && msg.type === 'txt' && (
                    <StyledSenderLabel>
                      {msg.senderName || msg.senderId}
                    </StyledSenderLabel>
                  )}
                  {msg.type === 'txt' && (
                    <StyledBubbleText>{msg.text}</StyledBubbleText>
                  )}
                  {msg.type === 'img' && (
                    <StyledImageAttachment src={msg.url} alt="" />
                  )}
                  {msg.type === 'file' && (
                    <StyledBubbleText>
                      Attachment: {msg.filename || 'File'}
                    </StyledBubbleText>
                  )}
                  {msg.type === 'audio' && (
                    <StyledAudio controls>
                      <source src={msg.url} />
                    </StyledAudio>
                  )}
                  {msg.type === 'video' && (
                    <StyledVideo controls>
                      <source src={msg.url} />
                    </StyledVideo>
                  )}

                  <StyledTimestamp $isOwn={isOwn}>{time}</StyledTimestamp>
                </StyledBubble>
              </StyledMessageRow>
            );
          })
        )}
      </StyledTimeline>

      <StyledComposerWrap>
        <StyledComposer onSubmit={handleSend}>
          <StyledToolbar>
            <StyledHiddenInput
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />
            <IconButton
              Icon={IconPaperclip}
              variant="tertiary"
              size="small"
              type="button"
              onClick={triggerFileSelect}
              ariaLabel="Attach file"
            />
            <IconButton
              Icon={isRecording ? IconPlayerStop : IconPlayerPlay}
              variant="tertiary"
              size="small"
              type="button"
              onClick={toggleRecording}
              ariaLabel={isRecording ? 'Stop recording' : 'Record voice'}
            />
          </StyledToolbar>

          {!isRecording ? (
            <StyledTextarea
              placeholder="Message…  (Enter to send, Shift+Enter for new line)"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              minRows={1}
              maxRows={8}
            />
          ) : (
            <StyledRecordingBanner>
              Recording… click stop to send
            </StyledRecordingBanner>
          )}

          <IconButton
            Icon={IconSend}
            variant="primary"
            size="small"
            type="submit"
            disabled={isRecording || !draft.trim()}
            ariaLabel="Send"
          />
        </StyledComposer>
      </StyledComposerWrap>
    </StyledContainer>
  );
};
