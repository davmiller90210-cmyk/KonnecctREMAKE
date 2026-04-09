import { useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
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
} from 'stream-chat';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { styled } from '@linaria/react';

import { tokenPairState } from '@/auth/states/tokenPairState';
import {
  REACT_APP_STREAM_API_KEY,
} from '~/config';

import '@stream-io/video-react-sdk/dist/css/styles.css';
import 'stream-chat-react/dist/css/v2/index.css';
import './CommunicationHub.css';

type HubStatus = 'idle' | 'loading' | 'ready' | 'error';

const StyledShell = styled.div`
  background: ${themeCssVariables.background.primary};
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
`;

const StyledSidebar = styled.div`
  border-right: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  min-width: 320px;
  width: 360px;
`;

const StyledThread = styled.div`
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
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

const StyledTopActions = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 10px 12px;
`;

const StyledActionButton = styled.button`
  background: ${themeCssVariables.color.blue5};
  border: none;
  border-radius: 6px;
  color: ${themeCssVariables.font.color.inverted};
  cursor: pointer;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  padding: 6px 10px;
`;

const StyledCallWrapper = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  height: 340px;
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
  const [activeChannel, setActiveChannel] = useState<
    StreamChannel<DefaultGenerics> | undefined
  >();
  const [activeCall, setActiveCall] = useState<Call | undefined>();
  const [isCallPanelOpen, setIsCallPanelOpen] = useState(false);

  const fallbackUid = useMemo(
    () => clerkUserId ?? 'stream-uid-1',
    [clerkUserId],
  );

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (
        !REACT_APP_STREAM_API_KEY
      ) {
        setStatus('error');
        setErrorMessage(
          'Stream is not configured. Missing REACT_APP_STREAM_API_KEY.',
        );
        return;
      }

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

        const { token, userId } = (await response.json()) as {
          token: string;
          userId: string;
        };

        const user = {
          id: userId,
          name: userId,
        };

        const chatClient = StreamChat.getInstance(REACT_APP_STREAM_API_KEY);

        await chatClient.connectUser(user, token);

        const generalChannel = chatClient.channel(
          'messaging',
          'konnecct-general',
          {
            members: [user.id],
            name: 'General',
          },
        );

        await generalChannel.watch();

        const videoClient = StreamVideoClient.getOrCreateInstance({
          apiKey: REACT_APP_STREAM_API_KEY,
          token,
          user,
        });

        if (!mounted) {
          await chatClient.disconnectUser();
          videoClient.disconnectUser();
          return;
        }

        setActiveChannel(generalChannel);
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
      streamVideoClient?.disconnectUser();
      void streamClient?.disconnectUser();
    };
  }, [
    clerkOrgId,
    crmToken,
    fallbackUid,
    getClerkToken,
    streamClient,
    streamVideoClient,
  ]);

  const handleStartCall = async () => {
    if (!streamVideoClient) {
      return;
    }

    const call = streamVideoClient.call('default', 'konnecct-main-room');

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

  return (
    <StyledShell>
      <Chat client={streamClient} theme="str-chat__theme-dark">
        <StyledSidebar>
          <ChannelList
            filters={{
              members: { $in: [streamClient.userID ?? fallbackUid] },
              type: 'messaging',
            }}
            onSelect={(channel) => setActiveChannel(channel)}
            sort={{ last_message_at: -1 }}
          />
        </StyledSidebar>
        <StyledThread>
          {activeChannel ? (
            <Channel channel={activeChannel}>
              <Window>
                <StyledTopActions>
                  <StyledActionButton type="button" onClick={handleStartCall}>
                    Start call
                  </StyledActionButton>
                  {isCallPanelOpen && (
                    <StyledActionButton type="button" onClick={handleEndCall}>
                      End call
                    </StyledActionButton>
                  )}
                </StyledTopActions>
                <ChannelHeader />
                <MessageList />
                <MessageInput />
              </Window>
              <Thread />
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
            </Channel>
          ) : (
            <StyledCenterState>
              Select a conversation to start messaging or calling.
            </StyledCenterState>
          )}
        </StyledThread>
      </Chat>
    </StyledShell>
  );
};
