import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import {
  Avatar,
  ChatContainer,
  Conversation,
  ConversationList,
  MainContainer,
  Message,
  MessageInput,
  MessageList,
  Sidebar,
  TypingIndicator,
} from '@chatscope/chat-ui-kit-react';
import {
  CallControls,
  SpeakerLayout,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  type Call,
} from '@stream-io/video-react-sdk';
import {
  Channel,
  ChannelHeader,
  ChannelList,
  Chat,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from 'stream-chat-react';
import {
  StreamChat,
  type Channel as StreamChannel,
  type DefaultGenerics,
  type MessageResponse,
} from 'stream-chat';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { styled } from '@linaria/react';

import { tokenPairState } from '@/auth/states/tokenPairState';
import {
  REACT_APP_STREAM_API_KEY,
} from '~/config';

import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import './CommunicationHub.css';

type HubStatus = 'idle' | 'loading' | 'ready' | 'error';
type ConversationSummary = {
  avatarName: string;
  channel: StreamChannel<DefaultGenerics>;
  id: string;
  info: string;
  title: string;
  unreadCount: number;
};

const StyledShell = styled.div`
  background: ${themeCssVariables.background.primary};
  display: flex;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
`;

const StyledCenterState = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex: 1 1 auto;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  justify-content: center;
  padding: 24px;
  text-align: center;
`;

const StyledError = styled(StyledCenterState)`
  color: ${themeCssVariables.color.red5};
`;

const StyledMainContainer = styled(MainContainer)`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 10px;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
`;

const StyledSidebar = styled(Sidebar)`
  background: ${themeCssVariables.background.secondary};
  border-right: 1px solid ${themeCssVariables.border.color.medium};
  width: 320px;
`;

const StyledSidebarHeader = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  flex-direction: column;
  font-family: ${themeCssVariables.font.family};
  gap: 4px;
  padding: 12px;
`;

const StyledSidebarTitle = styled.span`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledSidebarSubTitle = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledChatContainer = styled(ChatContainer)`
  background: ${themeCssVariables.background.primary};
  min-width: 0;
`;

const StyledTopBar = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-family: ${themeCssVariables.font.family};
  justify-content: space-between;
  min-height: 52px;
  padding: 0 12px;
`;

const StyledTopBarTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const StyledTopBarName = styled.span`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledTopBarMeta = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledTopActions = styled.div`
  align-items: center;
  display: flex;
  gap: 8px;
`;

const StyledActionButton = styled.button`
  background: ${themeCssVariables.background.transparent.light};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 8px;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: 6px 12px;
`;

const StyledCallWrapper = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  height: 300px;
`;

export const CommunicationHub = () => {
  const tokenPair = useAtomValue(tokenPairState.atom);
  const crmToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const { getToken: getClerkToken, orgId: clerkOrgId, userId: clerkUserId } =
    useClerkAuth();

  const [status, setStatus] = useState<HubStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamClient, setStreamClient] = useState<StreamChat>();
  const [streamVideoClient, setStreamVideoClient] = useState<StreamVideoClient>();
  const [conversationSummaries, setConversationSummaries] = useState<
    ConversationSummary[]
  >([]);
  const [activeChannel, setActiveChannel] = useState<StreamChannel<DefaultGenerics>>();
  const [channelMessages, setChannelMessages] = useState<MessageResponse<DefaultGenerics>[]>([]);
  const [draft, setDraft] = useState('');
  const [typingText, setTypingText] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<Call | undefined>();
  const [isCallPanelOpen, setIsCallPanelOpen] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeChannelRef = useRef<StreamChannel<DefaultGenerics> | undefined>(
    undefined,
  );

  const fallbackUid = useMemo(
    () => clerkUserId ?? 'stream-uid-1',
    [clerkUserId],
  );

  const toSummary = useCallback(
    (channel: StreamChannel<DefaultGenerics>): ConversationSummary => {
      const selfId = streamClient?.userID;
      const members = Object.values(channel.state.members ?? {});
      const otherMember = members.find((member) => member.user?.id !== selfId);
      const fallbackTitle = channel.data?.name ?? otherMember?.user?.name;
      const title =
        typeof fallbackTitle === 'string' && fallbackTitle.trim() !== ''
          ? fallbackTitle
          : otherMember?.user?.id ?? 'Conversation';
      const lastMessage =
        channel.state.messages[channel.state.messages.length - 1];
      const info =
        typeof lastMessage?.text === 'string' && lastMessage.text.trim() !== ''
          ? lastMessage.text
          : 'No messages yet';

      return {
        avatarName: title,
        channel,
        id: channel.cid,
        info,
        title,
        unreadCount: channel.countUnread() ?? 0,
      };
    },
    [streamClient?.userID],
  );

  const refreshConversations = useCallback(
    async (client: StreamChat) => {
      const selfId = client.userID ?? fallbackUid;
      const channels = await client.queryChannels(
        {
          members: { $in: [selfId] },
          type: 'messaging',
        },
        { last_message_at: -1 },
        { presence: true, state: true, watch: true },
      );

      const next = channels.map(toSummary);

      setConversationSummaries(next);

      const hasActive = next.some((c) => c.id === activeChannelRef.current?.cid);
      if (!hasActive && next[0]) {
        activeChannelRef.current = next[0].channel;
        setActiveChannel(next[0].channel);
      }
    },
    [fallbackUid, toSummary],
  );

  useEffect(() => {
    let mounted = true;
    let chatClientForCleanup: StreamChat | null = null;
    let videoClientForCleanup: StreamVideoClient | null = null;

    const init = async () => {
      setStatus('loading');

      try {
        const bearer = crmToken ?? (await getClerkToken());

        if (!bearer) {
          throw new Error('Missing auth token for Stream session bootstrap.');
        }

        const response = await fetch('/stream/token', {
          headers: {
            Authorization: `Bearer ${bearer}`,
            ...(clerkOrgId ? { 'X-Clerk-Org-Id': clerkOrgId } : {}),
            'X-Konnecct-Uid-Fallback': fallbackUid,
          },
        });

        if (!response.ok) {
          const raw = await response.text();
          throw new Error(raw || `Token endpoint failed with ${response.status}`);
        }

        const { apiKey, token, userId } = (await response.json()) as {
          apiKey?: string;
          token: string;
          userId: string;
        };
        const resolvedApiKey =
          REACT_APP_STREAM_API_KEY || apiKey;

        if (!resolvedApiKey) {
          throw new Error(
            'Stream API key missing from frontend config and token response.',
          );
        }

        const user = {
          id: userId,
          name: userId,
        };

        const chatClient = StreamChat.getInstance(resolvedApiKey);
        chatClientForCleanup = chatClient;

        await chatClient.connectUser(user, token);

        await refreshConversations(chatClient);

        const videoClient = StreamVideoClient.getOrCreateInstance({
          apiKey: resolvedApiKey,
          token,
          user,
        });
        videoClientForCleanup = videoClient;

        if (!mounted) {
          await chatClient.disconnectUser();
          videoClient.disconnectUser();
          return;
        }

        setStreamClient(chatClient);
        setStreamVideoClient(videoClient);
        setStatus('ready');
      } catch (error) {
        if (!mounted) {
          return;
        }

        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : String(error));
      }
    };

    void init();

    return () => {
      mounted = false;
      setIsCallPanelOpen(false);
      setActiveCall(undefined);
      activeChannelRef.current = undefined;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      videoClientForCleanup?.disconnectUser();
      void chatClientForCleanup?.disconnectUser();
    };
  }, [
    clerkOrgId,
    crmToken,
    fallbackUid,
    getClerkToken,
    refreshConversations,
  ]);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
    if (!activeChannel) {
      setChannelMessages([]);
      setTypingText(null);
      return;
    }

    setChannelMessages([...activeChannel.state.messages]);
    void activeChannel.markRead();
  }, [activeChannel]);

  useEffect(() => {
    if (!streamClient) {
      return;
    }

    const subscription = streamClient.on((event) => {
      if (
        event.type === 'message.new' ||
        event.type === 'notification.message_new' ||
        event.type === 'notification.added_to_channel' ||
        event.type === 'notification.mark_read'
      ) {
        void refreshConversations(streamClient);
      }

      const current = activeChannelRef.current;
      if (!current || event.cid !== current.cid) {
        return;
      }

      if (
        event.type === 'message.new' ||
        event.type === 'message.updated' ||
        event.type === 'message.deleted' ||
        event.type === 'notification.mark_read'
      ) {
        setChannelMessages([...current.state.messages]);
      }

      if (event.type === 'typing.start' || event.type === 'typing.stop') {
        const typers = Object.values(current.state.typing ?? {})
          .filter((typing) => typing.user?.id !== streamClient.userID)
          .map((typing) => typing.user?.name ?? typing.user?.id ?? 'Someone');

        setTypingText(typers.length > 0 ? `${typers[0]} is typing...` : null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshConversations, streamClient]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (!activeChannel) {
      return;
    }

    void activeChannel.keystroke();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      void activeChannel.stopTyping();
    }, 1500);
  };

  const handleSend = async () => {
    if (!activeChannel) {
      return;
    }

    const trimmed = draft.trim();
    if (trimmed === '') {
      return;
    }

    await activeChannel.sendMessage({ text: trimmed });
    setDraft('');
    void activeChannel.stopTyping();
  };

  const handleCreateDm = async () => {
    if (!streamClient?.userID) {
      return;
    }

    const targetUserId = window.prompt('Enter user id for DM');

    if (!targetUserId || targetUserId.trim() === '') {
      return;
    }

    const dmChannel = streamClient.channel('messaging', {
      distinct: true,
      members: [streamClient.userID, targetUserId.trim()],
    });

    await dmChannel.watch();
    await refreshConversations(streamClient);
    setActiveChannel(dmChannel);
  };

  const handleStartCall = async () => {
    if (!streamVideoClient || !activeChannel) {
      return;
    }

    const callId = `konnecct-${activeChannel.cid.replace(':', '-')}`;
    const call = streamVideoClient.call('default', callId);

    await call.join({
      create: true,
    });

    setActiveCall(call);
    setIsCallPanelOpen(true);
  };

  const handleEndCall = async () => {
    if (activeCall) {
      await activeCall.leave();
    }

    setActiveCall(undefined);
    setIsCallPanelOpen(false);
  };

  if (status === 'error') {
    return (
      <StyledError>
        {errorMessage ?? 'Failed to initialize Stream.'}
      </StyledError>
    );
  }

  if (status !== 'ready') {
    return <StyledCenterState>Connecting to Stream…</StyledCenterState>;
  }

  if (!streamClient) {
    return <StyledCenterState>Preparing chat client…</StyledCenterState>;
  }

  const activeSummary = conversationSummaries.find(
    (summary) => summary.id === activeChannel?.cid,
  );

  const selfId = streamClient.userID;

  return (
    <StyledShell>
      <StyledMainContainer responsive>
        <StyledSidebar position="left" scrollable={false}>
          <StyledSidebarHeader>
            <StyledSidebarTitle>Konnecct Chat</StyledSidebarTitle>
            <StyledSidebarSubTitle>{streamClient.userID}</StyledSidebarSubTitle>
          </StyledSidebarHeader>
          <ConversationList>
            {conversationSummaries.map((summary) => (
              <Conversation
                key={summary.id}
                active={summary.id === activeChannel?.cid}
                info={summary.info}
                name={summary.title}
                unreadCnt={summary.unreadCount}
                onClick={() => setActiveChannel(summary.channel)}
              >
                <Avatar name={summary.avatarName} />
              </Conversation>
            ))}
          </ConversationList>
        </StyledSidebar>
        <StyledChatContainer>
          {activeChannel ? (
            <>
              <StyledTopBar>
                <StyledTopBarTitle>
                  <StyledTopBarName>
                    {activeSummary?.title ?? 'Conversation'}
                  </StyledTopBarName>
                  <StyledTopBarMeta>
                    {channelMessages.length} messages
                  </StyledTopBarMeta>
                </StyledTopBarTitle>
                <StyledTopActions>
                  <StyledActionButton type="button" onClick={handleCreateDm}>
                    New DM
                  </StyledActionButton>
                  <StyledActionButton type="button" onClick={handleStartCall}>
                    Start call
                  </StyledActionButton>
                  {isCallPanelOpen ? (
                    <StyledActionButton type="button" onClick={handleEndCall}>
                      End call
                    </StyledActionButton>
                  ) : null}
                </StyledTopActions>
              </StyledTopBar>
              <MessageList
                typingIndicator={
                  typingText ? (
                    <TypingIndicator content={typingText} />
                  ) : undefined
                }
              >
                {channelMessages.map((message) => {
                  const direction =
                    message.user?.id === selfId ? 'outgoing' : 'incoming';
                  const messageText =
                    typeof message.text === 'string' && message.text.trim() !== ''
                      ? message.text
                      : '[Attachment]';

                  return (
                    <Message
                      key={message.id}
                      model={{
                        direction,
                        message: messageText,
                        position: 'single',
                        sender: message.user?.name ?? message.user?.id ?? 'User',
                        sentTime: new Date(
                          message.created_at ?? Date.now(),
                        ).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                      }}
                    >
                      <Avatar name={message.user?.name ?? message.user?.id ?? 'U'} />
                    </Message>
                  );
                })}
              </MessageList>
              <MessageInput
                attachButton={false}
                placeholder="Type your message"
                value={draft}
                onChange={handleDraftChange}
                onSend={handleSend}
              />
              {isCallPanelOpen && activeCall && streamVideoClient ? (
                <StyledCallWrapper>
                  <StreamVideo client={streamVideoClient}>
                    <StreamCall call={activeCall}>
                      <SpeakerLayout />
                      <CallControls />
                    </StreamCall>
                  </StreamVideo>
                </StyledCallWrapper>
              ) : null}
            </>
          ) : (
            <StyledCenterState>
              Select a conversation to start messaging or calling.
            </StyledCenterState>
          )}
        </StyledChatContainer>
      </StyledMainContainer>
    </StyledShell>
  );
};
