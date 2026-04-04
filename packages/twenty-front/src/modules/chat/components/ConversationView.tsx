import { useState, useRef, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import {
  Avatar,
  IconMicrophone,
  IconPaperclip,
  IconPlayerStop,
} from 'twenty-ui/display';
import { Button, LightIconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import {
  type ChatConversation,
  currentMessagesAtom,
} from '@/chat/states/agoraSessionState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

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
  min-height: 52px;
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[3]};
  background: ${themeCssVariables.background.secondary};
`;

const StyledHeaderName = styled.span`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledTimeline = styled.div`
  flex: 1 1 auto;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[4]} ${themeCssVariables.spacing[5]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

interface StyledMessageRowProps {
  isOwn: boolean;
}

const StyledMessageRow = styled.div<StyledMessageRowProps>`
  display: flex;
  flex-direction: ${({ isOwn }) => (isOwn ? 'row-reverse' : 'row')};
  align-items: flex-start;
  gap: ${themeCssVariables.spacing[2]};
  max-width: 100%;
`;

const StyledMessageColumn = styled.div<StyledMessageRowProps>`
  display: flex;
  flex-direction: column;
  align-items: ${({ isOwn }) => (isOwn ? 'flex-end' : 'flex-start')};
  max-width: min(100%, 520px);
  min-width: 0;
`;

const StyledSenderName = styled.span`
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.tertiary};
  margin-bottom: 4px;
  padding-left: 2px;
`;

const StyledBubble = styled.div<StyledMessageRowProps>`
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  border-radius: ${themeCssVariables.border.radius.md};
  background: ${({ isOwn }) =>
    isOwn
      ? themeCssVariables.color.blue9
      : themeCssVariables.background.secondary};
  border: 1px solid
    ${({ isOwn }) =>
      isOwn ? 'transparent' : themeCssVariables.border.color.medium};
  color: ${({ isOwn }) =>
    isOwn ? themeCssVariables.grayScale.white : themeCssVariables.font.color.primary};
`;

const StyledBubbleText = styled.p`
  margin: 0;
  font-size: ${themeCssVariables.font.size.sm};
  font-family: ${themeCssVariables.font.family};
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
`;

const StyledImageAttachment = styled.img`
  max-width: 100%;
  border-radius: ${themeCssVariables.border.radius.sm};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledTimestamp = styled.span`
  font-size: 10px;
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.light};
  margin-top: 4px;
  display: block;
  padding-left: 2px;
  padding-right: 2px;
`;

const StyledComposer = styled.form`
  display: flex;
  align-items: flex-end;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[5]};
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  flex-shrink: 0;
  background: ${themeCssVariables.background.secondary};
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
  background: ${themeCssVariables.background.primary};
  min-height: 40px;
  max-height: 120px;
  outline: none;

  &:focus {
    border-color: ${themeCssVariables.color.blue};
  }
`;

const StyledHiddenInput = styled.input`
  display: none;
`;

type ConversationViewProps = {
  conversation: ChatConversation;
  onSendMessage: (text: string) => void;
  onSendAttachment: (
    file: File,
    type: 'img' | 'file' | 'audio' | 'video',
  ) => void;
};

export const ConversationView = ({
  conversation,
  onSendMessage,
  onSendAttachment,
}: ConversationViewProps) => {
  const workspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const allMessagesMap = useAtomValue(currentMessagesAtom);
  const messages = allMessagesMap[conversation.id] || [];

  const timelineRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const ownPlaceholder =
    workspaceMember &&
    [workspaceMember.name.firstName, workspaceMember.name.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
  const ownAvatarUrl = workspaceMember?.avatarUrl ?? undefined;

  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [messages]);

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
    }
  };

  return (
    <StyledContainer>
      <StyledHeader>
        <StyledHeaderName>
          {conversation.name || t`Conversation`}
        </StyledHeaderName>
      </StyledHeader>

      <StyledTimeline ref={timelineRef}>
        {messages.map((msg) => {
          const isOwn = msg.direction === 'out';
          const displayName = msg.senderName || msg.senderId;
          const time = new Date(msg.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <StyledMessageRow key={msg.id} isOwn={isOwn}>
              {isOwn ? (
                <Avatar
                  size="sm"
                  rounded
                  placeholder={ownPlaceholder || '?'}
                  avatarUrl={ownAvatarUrl}
                  placeholderColorSeed={workspaceMember?.id}
                />
              ) : (
                <Avatar
                  size="sm"
                  rounded
                  placeholder={displayName}
                  avatarUrl={msg.senderAvatarUrl}
                  placeholderColorSeed={msg.senderId}
                />
              )}

              <StyledMessageColumn isOwn={isOwn}>
                {!isOwn && <StyledSenderName>{displayName}</StyledSenderName>}
                <StyledBubble isOwn={isOwn}>
                  {msg.type === 'txt' && (
                    <StyledBubbleText>{msg.text}</StyledBubbleText>
                  )}
                  {msg.type === 'img' && (
                    <StyledImageAttachment src={msg.url} alt="" />
                  )}
                  {msg.type === 'file' && (
                    <StyledBubbleText>
                      {msg.filename || t`Attachment`}
                    </StyledBubbleText>
                  )}
                  {msg.type === 'audio' && (
                    <audio
                      controls
                      style={{ maxWidth: 220, outline: 'none' }}
                    >
                      <source src={msg.url} />
                    </audio>
                  )}
                  {msg.type === 'video' && (
                    <video
                      controls
                      style={{ maxWidth: '100%', borderRadius: 4 }}
                    >
                      <source src={msg.url} />
                    </video>
                  )}
                  <StyledTimestamp
                    style={{ textAlign: isOwn ? 'right' : 'left' }}
                  >
                    {time}
                  </StyledTimestamp>
                </StyledBubble>
              </StyledMessageColumn>
            </StyledMessageRow>
          );
        })}
      </StyledTimeline>

      <StyledComposer onSubmit={handleSend}>
        <LightIconButton
          Icon={IconPaperclip}
          title={t`Attach file`}
          aria-label={t`Attach file`}
          onClick={triggerFileSelect}
        />
        <LightIconButton
          Icon={isRecording ? IconPlayerStop : IconMicrophone}
          title={isRecording ? t`Stop recording` : t`Voice note`}
          aria-label={isRecording ? t`Stop recording` : t`Voice note`}
          accent="secondary"
          active={isRecording}
          onClick={() => void toggleRecording()}
        />
        <StyledHiddenInput
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />

        {!isRecording ? (
          <StyledTextarea
            placeholder={t`Message…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
        ) : (
          <div
            style={{
              flex: '1 1 auto',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 12,
              color: themeCssVariables.color.red5,
              fontSize: themeCssVariables.font.size.sm,
              fontFamily: themeCssVariables.font.family,
            }}
          >
            {t`Recording…`}
          </div>
        )}

        <Button
          type="submit"
          title={t`Send`}
          variant="primary"
          accent="blue"
          disabled={isRecording || !draft.trim()}
        />
      </StyledComposer>
    </StyledContainer>
  );
};
