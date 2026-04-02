import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { styled } from '@linaria/react';
import { useParams } from 'react-router-dom';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import {
  agoraConnectionStateAtom,
  agoraConnectionErrorAtom,
  agoraConversationsAtom,
} from '@/chat/states/agoraSessionState';
import { useAgoraChat } from '@/chat/hooks/useAgoraChat';
import { ConversationView } from '@/chat/components/ConversationView';

const StyledShell = styled.div`
  display: flex;
  flex-direction: row;
  flex: 1 1 auto;
  height: 100%;
  overflow: hidden;
  background: ${themeCssVariables.background.primary};
`;

const StyledNoSelection = styled.div`
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.md};
  font-family: ${themeCssVariables.font.family};
`;

const StyledLoadingState = styled.div`
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  color: ${themeCssVariables.font.color.secondary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledErrorState = styled(StyledLoadingState)`
  color: ${themeCssVariables.color.red5};
`;

export const CommunicationHub = () => {
  const { '*' : conversationId } = useParams();
  const connectionState = useAtomValue(agoraConnectionStateAtom);
  const connectionError = useAtomValue(agoraConnectionErrorAtom);
  const conversations = useAtomValue(agoraConversationsAtom);
  const { connectToAgora, disconnectFromAgora, sendMessage, sendAttachment } = useAgoraChat();

  useEffect(() => {
    connectToAgora();
    return () => disconnectFromAgora();
  }, [connectToAgora, disconnectFromAgora]);

  if (connectionState === 'error') {
    return (
      <StyledErrorState>
        <span>Error connecting to Agora SDK</span>
        <span style={{ fontSize: '12px' }}>{connectionError}</span>
      </StyledErrorState>
    );
  }

  if (connectionState !== 'connected') {
    return (
      <StyledLoadingState>
        <span>Connecting to Agora Hub…</span>
      </StyledLoadingState>
    );
  }

  const selectedConversation = conversations.find((c) => c.id === conversationId) ?? null;

  return (
    <StyledShell>
      {selectedConversation ? (
        <ConversationView 
          conversation={selectedConversation} 
          onSendMessage={(text) => sendMessage(selectedConversation.id, text, selectedConversation.type)}
          onSendAttachment={(file, type) => sendAttachment(selectedConversation.id, file, type, selectedConversation.type)}
        />
      ) : (
        <StyledNoSelection>Select a conversation from the sidebar to start chatting</StyledNoSelection>
      )}
    </StyledShell>
  );
};
