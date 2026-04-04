import { useEffect, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { styled } from '@linaria/react';
import { useParams } from 'react-router-dom';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { tokenPairState } from '@/auth/states/tokenPairState';
import {
  agoraConnectionStateAtom,
  agoraConnectionErrorAtom,
  type ChatConversation,
} from '@/chat/states/agoraSessionState';
import { ChatWorkspaceSidebar } from '@/chat/components/ChatWorkspaceSidebar';
import { ConversationView } from '@/chat/components/ConversationView';
import { useAgoraChat } from '@/chat/hooks/useAgoraChat';
import { useChatWorkspaceLayout } from '@/chat/hooks/useChatWorkspaceLayout';

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
  const { channelId, dmThreadId } = useParams<{
    channelId?: string;
    dmThreadId?: string;
  }>();
  const connectionState = useAtomValue(agoraConnectionStateAtom);
  const connectionError = useAtomValue(agoraConnectionErrorAtom);
  const tokenPair = useAtomValue(tokenPairState.atom);
  const authToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  const { layout, isLoading, error: layoutError, reload } = useChatWorkspaceLayout();
  const {
    connectToAgora,
    disconnectFromAgora,
    sendMessage,
    sendAttachment,
    client,
  } = useAgoraChat();

  useEffect(() => {
    connectToAgora();
    return () => disconnectFromAgora();
  }, [connectToAgora, disconnectFromAgora]);

  const selectedChannel = useMemo(() => {
    if (!channelId || !layout) {
      return null;
    }

    for (const category of layout.categories) {
      const found = category.channels.find((c) => c.id === channelId);
      if (found) {
        return found;
      }
    }

    return null;
  }, [channelId, layout]);

  const selectedDm = useMemo(() => {
    if (!dmThreadId || !layout) {
      return null;
    }

    return layout.directThreads.find((t) => t.id === dmThreadId) ?? null;
  }, [dmThreadId, layout]);

  const selectedConversation: ChatConversation | null = useMemo(() => {
    if (selectedChannel) {
      if (!selectedChannel.agoraGroupId) {
        return null;
      }

      return {
        id: selectedChannel.agoraGroupId,
        type: 'groupChat',
        name: selectedChannel.name,
        unreadCount: 0,
        crmChannelId: selectedChannel.id,
      };
    }

    if (selectedDm) {
      const agoraTarget =
        selectedDm.agoraGroupId ?? selectedDm.peerAgoraUserId;

      if (!agoraTarget) {
        return null;
      }

      return {
        id: agoraTarget,
        type: selectedDm.agoraGroupId ? 'groupChat' : 'singleChat',
        name: selectedDm.title ?? 'Direct',
        unreadCount: 0,
        crmDmThreadId: selectedDm.id,
      };
    }

    return null;
  }, [selectedChannel, selectedDm]);

  useEffect(() => {
    if (
      connectionState !== 'connected' ||
      !client ||
      !selectedChannel?.agoraGroupId
    ) {
      return;
    }

    const groupId = selectedChannel.agoraGroupId;

    client.joinGroup({ groupId }).catch((err: unknown) => {
      console.warn('[KONNECCT-AGORA] joinGroup failed', err);
    });
  }, [client, connectionState, selectedChannel?.agoraGroupId]);

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
        <span>Connecting to chat…</span>
      </StyledLoadingState>
    );
  }

  const chatType = selectedConversation?.type ?? 'singleChat';

  const mainPane =
    layoutError && !layout ? (
      <StyledErrorState>
        <span>Could not load chat layout</span>
        <span style={{ fontSize: '12px' }}>{layoutError}</span>
      </StyledErrorState>
    ) : isLoading && !layout ? (
      <StyledLoadingState>
        <span>Loading workspace chat…</span>
      </StyledLoadingState>
    ) : selectedConversation ? (
        <ConversationView
          conversation={selectedConversation}
          onSendMessage={(text) =>
            sendMessage(selectedConversation.id, text, chatType)
          }
          onSendAttachment={(file, type) =>
            sendAttachment(
              selectedConversation.id,
              file,
              type,
              chatType,
            )
          }
        />
    ) : (
      <StyledNoSelection>
        {channelId || dmThreadId
          ? 'This conversation is not available or chat is still provisioning.'
          : 'Select a channel or direct message to start chatting'}
      </StyledNoSelection>
    );

  return (
    <StyledShell>
      <ChatWorkspaceSidebar
        layout={layout}
        selectedChannelId={channelId ?? null}
        selectedDmThreadId={dmThreadId ?? null}
        authToken={authToken}
        onLayoutRefresh={() => void reload()}
      />
      {mainPane}
    </StyledShell>
  );
};
