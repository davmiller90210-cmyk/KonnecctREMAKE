import { useEffect, useMemo, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useParams } from 'react-router-dom';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { ChatWorkspaceSidebar } from '@/chat/components/ChatWorkspaceSidebar';
import { ConversationView } from '@/chat/components/ConversationView';
import { useAgoraChat } from '@/chat/hooks/useAgoraChat';
import { useChatWorkspaceLayout } from '@/chat/hooks/useChatWorkspaceLayout';
import {
  agoraConnectionStateAtom,
  agoraConnectionErrorAtom,
  lastInboundChatNotifyAtom,
} from '@/chat/states/agoraSessionState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

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

const StyledLayoutHint = styled.div`
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.color.red5};
  font-family: ${themeCssVariables.font.family};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
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
  const {
    layout,
    isLoading: layoutLoading,
    error: layoutError,
    reload: reloadChatLayout,
  } = useChatWorkspaceLayout();
  const {
    connectToAgora,
    disconnectFromAgora,
    sendMessage,
    sendAttachment,
    client: agoraClient,
  } = useAgoraChat();
  const inboundNotify = useAtomValue(lastInboundChatNotifyAtom);
  const { enqueueSuccessSnackBar } = useSnackBar();
  const lastSnackIdRef = useRef<string | null>(null);

  const selectedConversation = useMemo(() => {
    if (!layout) {
      return null;
    }

    if (channelId) {
      const channel = layout.categories
        .flatMap((category) => category.channels)
        .find((item) => item.id === channelId);

      if (!channel) {
        return null;
      }

      const agoraTargetId = channel.agoraGroupId ?? channel.id;

      return {
        id: agoraTargetId,
        type: 'groupChat' as const,
        name: channel.name.startsWith('#') ? channel.name : `#${channel.name}`,
        unreadCount: 0,
      };
    }

    if (dmThreadId) {
      const thread = layout.directThreads.find(
        (item) => item.id === dmThreadId,
      );

      if (!thread) {
        return null;
      }

      const isGroup = thread.kind === 'group';
      const agoraTargetId = isGroup
        ? (thread.agoraGroupId ?? thread.id)
        : (thread.peerAgoraUserId ?? thread.id);

      return {
        id: agoraTargetId,
        type: isGroup ? ('groupChat' as const) : ('singleChat' as const),
        name: thread.title ?? t`Direct message`,
        unreadCount: 0,
      };
    }

    return null;
  }, [layout, channelId, dmThreadId]);

  useEffect(() => {
    connectToAgora();
    return () => disconnectFromAgora();
  }, [connectToAgora, disconnectFromAgora]);

  useEffect(() => {
    if (!inboundNotify) {
      return;
    }

    if (lastSnackIdRef.current === inboundNotify.messageId) {
      return;
    }

    const activeAgoraId = selectedConversation?.id ?? null;

    if (inboundNotify.conversationId === activeAgoraId) {
      return;
    }

    lastSnackIdRef.current = inboundNotify.messageId;
    enqueueSuccessSnackBar({
      message: `${inboundNotify.senderName}: ${inboundNotify.preview}`,
      options: {
        dedupeKey: `chat-${inboundNotify.messageId}`,
      },
    });
  }, [inboundNotify, selectedConversation?.id, enqueueSuccessSnackBar]);

  useEffect(() => {
    if (connectionState !== 'connected' || !agoraClient || !selectedConversation) {
      return;
    }

    if (selectedConversation.type !== 'groupChat') {
      return;
    }

    const groupId = selectedConversation.id;

    if (!groupId) {
      return;
    }

    void agoraClient
      .joinGroup({
        groupId,
        message: 'Konnecct',
      })
      .catch((err: unknown) => {
        const text =
          err instanceof Error ? err.message : JSON.stringify(err ?? '');
        if (
          text.includes('already') ||
          text.includes('member') ||
          text.includes('joined')
        ) {
          return;
        }
        console.warn('[KONNECCT-AGORA] joinGroup', err);
      });
  }, [
    connectionState,
    agoraClient,
    selectedConversation?.id,
    selectedConversation?.type,
  ]);

  if (connectionState === 'error') {
    return (
      <StyledErrorState>
        <span>{t`Error connecting to Agora`}</span>
        <span style={{ fontSize: '12px' }}>{connectionError}</span>
      </StyledErrorState>
    );
  }

  if (connectionState === 'waiting_session' || connectionState === 'idle') {
    return (
      <StyledLoadingState>
        <span>{t`Preparing workspace and chat…`}</span>
        <span style={{ fontSize: '12px', textAlign: 'center', maxWidth: 360 }}>
          {connectionState === 'waiting_session'
            ? t`Choose a Clerk organization (or create one). Konnecct needs an org to load your CRM and issue a session.`
            : t`Starting…`}
        </span>
      </StyledLoadingState>
    );
  }

  if (connectionState !== 'connected') {
    return (
      <StyledLoadingState>
        <span>{t`Connecting to Agora Hub…`}</span>
      </StyledLoadingState>
    );
  }

  return (
    <StyledShell>
      <ChatWorkspaceSidebar
        layout={layout}
        selectedChannelId={channelId ?? null}
        selectedDmThreadId={dmThreadId ?? null}
        authToken={authToken}
        onLayoutRefresh={reloadChatLayout}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 auto',
          minWidth: 0,
        }}
      >
        {layoutError && (
          <StyledLayoutHint>
            {t`Could not load channel list`}: {layoutError}
          </StyledLayoutHint>
        )}
        {layoutLoading && !layout && (
          <StyledLoadingState style={{ flex: '0 0 auto', padding: 16 }}>
            <span>{t`Loading channels…`}</span>
          </StyledLoadingState>
        )}
        {selectedConversation ? (
          <ConversationView
            conversation={selectedConversation}
            onSendMessage={(text) =>
              sendMessage(
                selectedConversation.id,
                text,
                selectedConversation.type === 'groupChat'
                  ? 'groupChat'
                  : 'singleChat',
              )
            }
            onSendAttachment={(file, type) =>
              sendAttachment(
                selectedConversation.id,
                file,
                type,
                selectedConversation.type === 'groupChat'
                  ? 'groupChat'
                  : 'singleChat',
              )
            }
          />
        ) : (
          <StyledNoSelection>
            {t`Select a channel or direct message from the sidebar to start chatting`}
          </StyledNoSelection>
        )}
      </div>
    </StyledShell>
  );
};
