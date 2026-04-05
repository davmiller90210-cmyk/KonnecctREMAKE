import { useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { styled } from '@linaria/react';
import { useNavigate, useParams } from 'react-router-dom';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { ChatInfoPanel } from '@/chat/components/ChatInfoPanel';
import { ChatRail } from '@/chat/components/ChatRail';
import { ChatWorkspaceSidebar } from '@/chat/components/ChatWorkspaceSidebar';
import { ConversationView } from '@/chat/components/ConversationView';
import { useAgoraChat } from '@/chat/hooks/useAgoraChat';
import { useChatResponsiveLayout } from '@/chat/hooks/useChatResponsiveLayout';
import { useChatWorkspaceLayout } from '@/chat/hooks/useChatWorkspaceLayout';
import { useChatWorkspaceMembers } from '@/chat/hooks/useChatWorkspaceMembers';
import {
  agoraConnectionStateAtom,
  agoraConnectionErrorAtom,
  type ChatConversation,
} from '@/chat/states/agoraSessionState';

const StyledShell = styled.div`
  display: flex;
  flex-direction: row;
  flex: 1 1 auto;
  height: 100%;
  overflow: hidden;
  background: ${themeCssVariables.background.primary};
`;

const StyledListColumn = styled.div<{ $grow: boolean }>`
  display: flex;
  flex-direction: column;
  flex: ${({ $grow }) => ($grow ? '1 1 auto' : '0 0 auto')};
  min-width: 0;
  max-width: ${({ $grow }) => ($grow ? 'none' : '308px')};
  height: 100%;
`;

const StyledThreadColumn = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
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

const StyledInfoBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10050;
  background: rgba(15, 23, 42, 0.42);
  display: flex;
  justify-content: flex-end;
  align-items: stretch;
`;

const StyledInfoSheet = styled.div`
  max-width: 360px;
  width: 100%;
  height: 100%;
  box-shadow: ${themeCssVariables.boxShadow.strong};
`;

const StyledErrorDetail = styled.span`
  font-size: 12px;
`;

export const CommunicationHub = () => {
  const { channelId, dmThreadId } = useParams<{
    channelId?: string;
    dmThreadId?: string;
  }>();
  const navigate = useNavigate();
  const connectionState = useAtomValue(agoraConnectionStateAtom);
  const connectionError = useAtomValue(agoraConnectionErrorAtom);
  const tokenPair = useAtomValue(tokenPairState.atom);
  const authToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  const { isMobile, isNarrowDesktop } = useChatResponsiveLayout();
  const [infoOpen, setInfoOpen] = useState(true);
  const [openDmSignal, setOpenDmSignal] = useState(0);

  const { layout, isLoading, error: layoutError, reload } =
    useChatWorkspaceLayout();
  const { members } = useChatWorkspaceMembers(authToken);
  const {
    connectToAgora,
    disconnectFromAgora,
    sendMessage,
    sendAttachment,
    syncConversationHistory,
    client,
  } = useAgoraChat();

  useEffect(() => {
    connectToAgora();
    return () => disconnectFromAgora();
  }, [connectToAgora, disconnectFromAgora]);

  useEffect(() => {
    if (isMobile || isNarrowDesktop) {
      setInfoOpen(false);
    } else {
      setInfoOpen(true);
    }
  }, [isMobile, isNarrowDesktop]);

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
    if (connectionState !== 'connected' || !client) {
      return;
    }

    const groupId =
      selectedChannel?.agoraGroupId ?? selectedDm?.agoraGroupId ?? null;

    if (!groupId) {
      return;
    }

    client.joinGroup({ groupId }).catch((err: unknown) => {
      console.warn('[KONNECCT-AGORA] joinGroup failed', err);
    });
  }, [
    client,
    connectionState,
    selectedChannel?.agoraGroupId,
    selectedDm?.agoraGroupId,
  ]);

  useEffect(() => {
    if (connectionState !== 'connected' || !client || !selectedConversation) {
      return;
    }

    const chatType =
      selectedConversation.type === 'groupChat' ? 'groupChat' : 'singleChat';

    void syncConversationHistory(selectedConversation.id, chatType);
  }, [
    client,
    connectionState,
    selectedConversation?.id,
    selectedConversation?.type,
    syncConversationHistory,
  ]);

  const chatType = selectedConversation?.type ?? 'singleChat';

  const memberCountPreview = members.length + 1;
  const metaLine =
    selectedConversation?.type === 'groupChat'
      ? `${memberCountPreview} members · preview`
      : `Direct · live delivery`;

  const showInfoOverlay =
    !!selectedConversation && infoOpen && (isNarrowDesktop || isMobile);

  const showInfoDocked =
    !!selectedConversation &&
    infoOpen &&
    !isNarrowDesktop &&
    !isMobile;

  const showListColumn = !isMobile || !selectedConversation;

  const mainPane =
    layoutError && !layout ? (
      <StyledErrorState>
        <span>Could not load chat layout</span>
        <StyledErrorDetail>{layoutError}</StyledErrorDetail>
      </StyledErrorState>
    ) : isLoading && !layout ? (
      <StyledLoadingState>
        <span>Loading workspace chat…</span>
      </StyledLoadingState>
    ) : selectedConversation ? (
      <ConversationView
        conversation={selectedConversation}
        metaLine={metaLine}
        onBack={
          isMobile ? () => navigate('/chat') : undefined
        }
        onOpenDetails={() => setInfoOpen(true)}
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

  if (connectionState === 'error') {
    return (
      <StyledErrorState>
        <span>Error connecting to Agora SDK</span>
        <StyledErrorDetail>{connectionError}</StyledErrorDetail>
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

  return (
    <>
      <StyledShell>
        {!isMobile && (
          <ChatRail
            viewerLabel="Me"
            onCompose={() => setOpenDmSignal((n) => n + 1)}
          />
        )}
        {showListColumn ? (
          <StyledListColumn $grow={isMobile && !selectedConversation}>
            <ChatWorkspaceSidebar
              layout={layout}
              selectedChannelId={channelId ?? null}
              selectedDmThreadId={dmThreadId ?? null}
              authToken={authToken}
              onLayoutRefresh={() => void reload()}
              members={members}
              viewerUserWorkspaceId={layout?.viewer.userWorkspaceId ?? null}
              fullWidth={isMobile && !selectedConversation}
              openDmSignal={openDmSignal}
            />
          </StyledListColumn>
        ) : null}
        {(!isMobile || !!selectedConversation) && (
          <StyledThreadColumn>{mainPane}</StyledThreadColumn>
        )}
        {showInfoDocked && selectedConversation && (
          <ChatInfoPanel
            title={selectedConversation.name}
            isGroup={selectedConversation.type === 'groupChat'}
            memberCount={memberCountPreview}
            members={members}
            onClose={() => setInfoOpen(false)}
          />
        )}
      </StyledShell>
      {showInfoOverlay && selectedConversation && (
        <StyledInfoBackdrop
          role="presentation"
          onClick={() => setInfoOpen(false)}
        >
          <StyledInfoSheet
            role="dialog"
            aria-label="Conversation details"
            onClick={(e) => e.stopPropagation()}
          >
            <ChatInfoPanel
              title={selectedConversation.name}
              isGroup={selectedConversation.type === 'groupChat'}
              memberCount={memberCountPreview}
              members={members}
              onClose={() => setInfoOpen(false)}
            />
          </StyledInfoSheet>
        </StyledInfoBackdrop>
      )}
    </>
  );
};
