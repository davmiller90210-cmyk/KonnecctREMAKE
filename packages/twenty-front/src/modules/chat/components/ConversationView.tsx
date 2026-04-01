import { useState, useRef, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { 
  ChatConversation, 
  currentMessagesAtom 
} from '@/chat/states/agoraSessionState';

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
  flex-direction: ${({ isOwn }) => (isOwn ? 'row-reverse' : 'row')};
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
  border-radius: ${({ isOwn }) =>
    isOwn
      ? `${themeCssVariables.border.radius.md} ${themeCssVariables.border.radius.sm} ${themeCssVariables.border.radius.sm} ${themeCssVariables.border.radius.md}`
      : `${themeCssVariables.border.radius.sm} ${themeCssVariables.border.radius.md} ${themeCssVariables.border.radius.md} ${themeCssVariables.border.radius.sm}`};
  background: ${({ isOwn }) =>
    isOwn
      ? themeCssVariables.color.blue9
      : themeCssVariables.background.secondary};
  color: ${({ isOwn }) =>
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

const StyledImageAttachment = styled.img`
  max-width: 100%;
  border-radius: ${themeCssVariables.border.radius.sm};
  margin-top: ${themeCssVariables.spacing[1]};
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
`;

const StyledActionArea = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledButton = styled.button<{ primary?: boolean, recording?: boolean }>`
  height: 40px;
  padding: 0 ${themeCssVariables.spacing[3]};
  border-radius: ${themeCssVariables.border.radius.md};
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ primary, recording }) => {
    if (recording) return themeCssVariables.color.red5;
    if (primary) return themeCssVariables.color.blue9;
    return themeCssVariables.background.transparent.medium;
  }};
  color: ${({ primary, recording }) => (primary || recording) ? '#ffffff' : themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  font-family: ${themeCssVariables.font.family};
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: ${({ primary, recording }) => {
      if (recording) return themeCssVariables.color.red6;
      if (primary) return themeCssVariables.color.blue10;
      return themeCssVariables.background.transparent.dark;
    }};
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

const StyledHiddenInput = styled.input`
  display: none;
`;

// ─── Component ────────────────────────────────────────────────────────────────

type ConversationViewProps = {
  conversation: ChatConversation;
  onSendMessage: (text: string) => void;
  onSendAttachment: (file: File, type: 'img' | 'file' | 'audio' | 'video') => void;
};

export const ConversationView = ({ conversation, onSendMessage, onSendAttachment }: ConversationViewProps) => {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const allMessagesMap = useAtomValue(currentMessagesAtom);
  const messages = allMessagesMap[conversation.id] || [];
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || isSending) return;

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

  // ─── Attachments ──────────────────────────────────────────────────
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Determine type by mime
    const type = file.type.startsWith('image/') ? 'img' : 
                 file.type.startsWith('video/') ? 'video' : 
                 file.type.startsWith('audio/') ? 'audio' : 'file';
    
    onSendAttachment(file, type);
    e.target.value = ''; // reset
  };

  // ─── Voice Notes ──────────────────────────────────────────────────
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
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `Voice_Note_${Date.now()}.webm`, { type: 'audio/webm' });
        
        onSendAttachment(file, 'audio');
        
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or unavailable", err);
      alert("Microphone access is required for voice notes.");
    }
  };

  return (
    <StyledContainer>
      <StyledHeader>
        <StyledHeaderName>{conversation.name || 'Conversation'}</StyledHeaderName>
      </StyledHeader>

      <StyledTimeline ref={timelineRef}>
        {messages.map((msg) => {
          const isOwn = msg.direction === 'out';
          const initial = msg.senderName ? msg.senderName.charAt(0).toUpperCase() : msg.senderId.charAt(0).toUpperCase();
          const time = new Date(msg.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <StyledMessageRow key={msg.id} isOwn={isOwn}>
              {!isOwn && <StyledAvatar>{initial}</StyledAvatar>}
              
              <StyledBubble isOwn={isOwn}>
                {msg.type === 'txt' && <StyledBubbleText>{msg.text}</StyledBubbleText>}
                {msg.type === 'img' && <StyledImageAttachment src={msg.url} alt="Attachment" />}
                {msg.type === 'file' && <StyledBubbleText>📎 {msg.filename || 'File Attachment'}</StyledBubbleText>}
                {msg.type === 'audio' && (
                  <audio controls style={{ maxWidth: '200px', outline: 'none' }}>
                    <source src={msg.url} />
                  </audio>
                )}
                {msg.type === 'video' && (
                  <video controls style={{ maxWidth: '100%', borderRadius: '4px' }}>
                    <source src={msg.url} />
                  </video>
                )}
                
                <StyledTimestamp>{time}</StyledTimestamp>
              </StyledBubble>
            </StyledMessageRow>
          );
        })}
      </StyledTimeline>

      <StyledComposer onSubmit={handleSend}>
        <StyledActionArea>
           <StyledHiddenInput 
             type="file" 
             ref={fileInputRef} 
             onChange={handleFileChange} 
             accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
           />
           <StyledButton type="button" onClick={triggerFileSelect}>📎</StyledButton>
           <StyledButton 
             type="button" 
             onClick={toggleRecording} 
             recording={isRecording}
             title={isRecording ? "Stop & Send" : "Record Voice Note"}
           >
             {isRecording ? '⏹' : '🎤'}
           </StyledButton>
        </StyledActionArea>

        {!isRecording ? (
          <StyledTextarea
            placeholder="Write a message… (Enter to send, Shift+Enter for new line)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
        ) : (
          <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', paddingLeft: '12px', color: themeCssVariables.color.red6 }}>
            Recording voice note...
          </div>
        )}
        
        <StyledButton primary type="submit" disabled={isRecording || (!draft.trim() && !isSending)}>
          Send
        </StyledButton>
      </StyledComposer>
    </StyledContainer>
  );
};
