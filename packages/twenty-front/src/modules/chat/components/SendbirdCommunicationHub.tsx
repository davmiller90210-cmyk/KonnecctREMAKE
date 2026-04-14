import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useAtomValue } from 'jotai';
import { formatDistanceToNow } from 'date-fns';
import SendbirdChat, {
  SessionHandler,
  type SendbirdChatWith,
} from '@sendbird/chat';
import {
  GroupChannelHandler,
  GroupChannelModule,
  type GroupChannel,
} from '@sendbird/chat/groupChannel';
import {
  MessageType,
  MessageTypeFilter,
  type BaseMessage,
  type FileMessage,
  type UserMessage,
} from '@sendbird/chat/message';
import * as SendBirdCall from 'sendbird-calls';
import { Button, SearchInput } from 'twenty-ui/input';
import {
  Avatar,
  IconPhone,
  IconPlus,
  IconSend,
  IconUsers,
  IconWorld,
} from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { CreateChannelModal } from '@/chat/components/CreateChannelModal';
import { NewDmModal } from '@/chat/components/NewDmModal';
import { useChatWorkspaceLayout } from '@/chat/hooks/useChatWorkspaceLayout';
import {
  type ChatWorkspaceLayoutChannel,
  type ChatWorkspaceLayoutDm,
} from '@/chat/types/chat-workspace-layout.type';
import { REACT_APP_SENDBIRD_APP_ID } from '~/config';

type SendbirdClient = SendbirdChatWith<[GroupChannelModule]>;

const HANDLER_KEY = 'konnecct-sendbird-hub';
const CALL_LISTENER_KEY = 'konnecct-sendbird-calls';

type SendbirdSessionResponse = {
  appId: string;
  userId: string;
  sessionToken: string;
  expiresAt?: number;
};

type HubSelection =
  | { kind: 'channel'; channel: ChatWorkspaceLayoutChannel }
  | { kind: 'dm'; dm: ChatWorkspaceLayoutDm };

const StyledRoot = styled.div`
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  width: 100%;
  background: ${themeCssVariables.background.noisy};
`;

const StyledSidebar = styled.aside`
  border-right: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 280px;
  flex-shrink: 0;
  background: ${themeCssVariables.background.primary};
`;

const StyledSidebarHeader = styled.div`
  padding: ${themeCssVariables.spacing[3]};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  flex-wrap: wrap;
`;

const StyledSidebarScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
`;

const StyledChannelButton = styled.button<{ $active: boolean }>`
  align-items: center;
  background: ${({ $active }) =>
    $active
      ? themeCssVariables.background.transparent.medium
      : 'transparent'};
  border: none;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  text-align: left;
  width: 100%;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledCategoryLabel = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]} 0;
  text-transform: uppercase;
`;

const StyledMain = styled.main`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
`;

const StyledMainHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledTitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const StyledTitle = styled.h2`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledSub = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledCallActions = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledMessages = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[3]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledMessageRow = styled.div<{ $own: boolean }>`
  align-self: ${({ $own }) => ($own ? 'flex-end' : 'flex-start')};
  background: ${({ $own }) =>
    $own
      ? themeCssVariables.color.blue3
      : themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.sm};
   color: ${({ $own }) =>
    $own ? themeCssVariables.grayScale.gray12 : themeCssVariables.font.color.primary};
  max-width: min(560px, 85%);
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledMessageMeta = styled.div`
  font-size: 10px;
  margin-top: 4px;
  opacity: 0.85;
`;

const StyledComposer = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
  align-items: flex-end;
`;

const StyledTextarea = styled.textarea`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  flex: 1 1 auto;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  min-height: 40px;
  max-height: 120px;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  resize: vertical;
`;

const StyledMuted = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledError = styled.div`
  color: ${themeCssVariables.color.red5};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledGroupCallBar = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledIncomingBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 12000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledIncomingPanel = styled.div`
  background: ${themeCssVariables.background.primary};
  border-radius: ${themeCssVariables.border.radius.md};
  border: 1px solid ${themeCssVariables.border.color.medium};
  max-width: 400px;
  padding: ${themeCssVariables.spacing[5]};
  width: 100%;
`;

const StyledVideoDock = styled.div<{ $expanded: boolean }>`
  position: fixed;
  right: ${themeCssVariables.spacing[3]};
  bottom: ${themeCssVariables.spacing[3]};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  z-index: 50;
  max-width: ${({ $expanded }) => ($expanded ? 'min(360px, 90vw)' : '2px')};
  opacity: ${({ $expanded }) => ($expanded ? 1 : 0.01)};
  overflow: hidden;
  pointer-events: ${({ $expanded }) => ($expanded ? 'auto' : 'none')};

  video {
    flex: 1 1 50%;
    max-height: 160px;
    width: ${({ $expanded }) => ($expanded ? 'auto' : '1px')};
    background: #000;
    border-radius: ${themeCssVariables.border.radius.sm};
  }
`;

async function fetchSendbirdSession(
  bearer: string,
): Promise<SendbirdSessionResponse> {
  const response = await fetch('/sendbird/session', {
    headers: { Authorization: `Bearer ${bearer}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.trim() || `HTTP ${response.status}`);
  }

  return (await response.json()) as SendbirdSessionResponse;
}

function selectionTitle(sel: HubSelection | null): string {
  if (!sel) {
    return '';
  }
  if (sel.kind === 'channel') {
    return `#${sel.channel.slug}`;
  }
  return sel.dm.title?.trim() || t`Direct message`;
}

function senderUserId(m: BaseMessage): string | undefined {
  if (m.messageType === MessageType.USER) {
    return (m as UserMessage).sender?.userId;
  }
  if (m.messageType === MessageType.FILE) {
    return (m as FileMessage).sender?.userId;
  }
  return undefined;
}

function messageBody(m: BaseMessage): string {
  if (m.messageType === MessageType.USER) {
    return m.message;
  }
  if (m.messageType === MessageType.FILE) {
    return t`[File]`;
  }
  if (m.messageType === MessageType.ADMIN) {
    return m.message || t`[System]`;
  }
  return t`[Message]`;
}

export const SendbirdCommunicationHub = () => {
  const tokenPair = useAtomValue(tokenPairState.atom);
  const crmToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  const { layout, isLoading: layoutLoading, error: layoutError, reload } =
    useChatWorkspaceLayout();

  const [connectError, setConnectError] = useState<string | null>(null);
  const [sb, setSb] = useState<SendbirdClient | null>(null);
  const [callsReady, setCallsReady] = useState(false);
  const sessionUserIdRef = useRef<string | null>(null);
  const fetchSessionRef = useRef<() => Promise<string>>(async () => '');

  const [selection, setSelection] = useState<HubSelection | null>(null);
  const [pendingDmThreadId, setPendingDmThreadId] = useState<string | null>(
    null,
  );
  const [pendingChannelId, setPendingChannelId] = useState<string | null>(
    null,
  );
  const [channelUrl, setChannelUrl] = useState<string | null>(null);
  const [groupChannel, setGroupChannel] = useState<GroupChannel | null>(null);
  const [messages, setMessages] = useState<BaseMessage[]>([]);
  const [composer, setComposer] = useState('');
  const [search, setSearch] = useState('');

  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [dmModalOpen, setDmModalOpen] = useState(false);

  const [groupRoomIdInput, setGroupRoomIdInput] = useState('');
  const [activeGroupRoom, setActiveGroupRoom] = useState<
    SendBirdCall.Room | null
  >(null);

  const [incomingCall, setIncomingCall] = useState<SendBirdCall.DirectCall | null>(
    null,
  );
  const [outgoingCall, setOutgoingCall] = useState<SendBirdCall.DirectCall | null>(
    null,
  );

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const activeChannelUrlRef = useRef<string | null>(null);
  activeChannelUrlRef.current = channelUrl;

  const sbInstanceRef = useRef<SendbirdClient | null>(null);

  const viewerUserWorkspaceId = layout?.viewer.userWorkspaceId;

  useEffect(() => {
    if (!pendingDmThreadId || !layout) {
      return;
    }
    const dm = layout.directThreads.find((d) => d.id === pendingDmThreadId);
    if (dm) {
      setSelection({ kind: 'dm', dm });
      setPendingDmThreadId(null);
    }
  }, [layout, pendingDmThreadId]);

  useEffect(() => {
    if (!pendingChannelId || !layout) {
      return;
    }
    for (const cat of layout.categories) {
      const ch = cat.channels.find((c) => c.id === pendingChannelId);
      if (ch) {
        setSelection({ kind: 'channel', channel: ch });
        setPendingChannelId(null);
        break;
      }
    }
  }, [layout, pendingChannelId]);

  useEffect(() => {
    fetchSessionRef.current = async () => {
      if (!crmToken) {
        throw new Error('Missing auth token');
      }
      const session = await fetchSendbirdSession(crmToken);
      return session.sessionToken;
    };
  }, [crmToken]);

  useEffect(() => {
    if (!crmToken) {
      setSb(null);
      setCallsReady(false);
      sessionUserIdRef.current = null;
      return;
    }

    let cancelled = false;

    void (async () => {
      setConnectError(null);
      try {
        const session = await fetchSendbirdSession(crmToken);
        if (cancelled) {
          return;
        }

        const appId =
          session.appId?.trim() || REACT_APP_SENDBIRD_APP_ID.trim();
        if (!appId) {
          throw new Error(
            'Sendbird app id missing (server SENDBIRD_APPLICATION_ID or REACT_APP_SENDBIRD_APP_ID).',
          );
        }

        sessionUserIdRef.current = session.userId;

        const instance = SendbirdChat.init({
          appId,
          modules: [new GroupChannelModule()],
        });

        const sessionHandler = new SessionHandler({
          onSessionTokenRequired: (resolve, reject) => {
            void (async () => {
              try {
                const token = await fetchSessionRef.current();
                resolve(token);
              } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            })();
          },
        });
        instance.setSessionHandler(sessionHandler);

        await instance.connect(session.userId, session.sessionToken);
        sbInstanceRef.current = instance;

        const groupHandler = new GroupChannelHandler({
          onMessageReceived: (ch, message) => {
            if (ch.url === activeChannelUrlRef.current) {
              setMessages((prev) => [...prev, message]);
            }
          },
        });
        instance.groupChannel.addGroupChannelHandler(HANDLER_KEY, groupHandler);

        SendBirdCall.init(appId);
        await SendBirdCall.authenticate({
          userId: session.userId,
          accessToken: session.sessionToken,
        });
        await SendBirdCall.connectWebSocket();

        SendBirdCall.addListener(CALL_LISTENER_KEY, {
          onRinging: (call) => {
            setIncomingCall(call);
          },
        });

        if (!cancelled) {
          setSb(instance);
          setCallsReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          setConnectError(e instanceof Error ? e.message : String(e));
          setSb(null);
          setCallsReady(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      const inst = sbInstanceRef.current;
      sbInstanceRef.current = null;
      if (inst) {
        try {
          inst.groupChannel.removeGroupChannelHandler(HANDLER_KEY);
        } catch {
          // ignore
        }
        void inst.disconnect().catch(() => undefined);
      }
      try {
        SendBirdCall.removeListener(CALL_LISTENER_KEY);
        SendBirdCall.deauthenticate();
      } catch {
        // ignore
      }
      setSb(null);
      setCallsReady(false);
    };
  }, [crmToken]);

  useEffect(() => {
    if (!selection) {
      setChannelUrl(null);
      return;
    }
    const url =
      selection.kind === 'channel'
        ? selection.channel.sendbirdChannelUrl
        : selection.dm.sendbirdChannelUrl;
    setChannelUrl(url);
  }, [selection]);

  useEffect(() => {
    if (!sb || !channelUrl) {
      setGroupChannel(null);
      setMessages([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const ch = await sb.groupChannel.getChannel(channelUrl);
        if (cancelled) {
          return;
        }
        setGroupChannel(ch);
        await ch.markAsRead();
        const query = ch.createPreviousMessageListQuery({
          limit: 50,
          reverse: true,
          messageTypeFilter: MessageTypeFilter.ALL,
        });
        const loaded = await query.load();
        if (!cancelled) {
          setMessages([...loaded].reverse());
        }
      } catch (e) {
        if (!cancelled) {
          setConnectError(e instanceof Error ? e.message : String(e));
          setGroupChannel(null);
          setMessages([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sb, channelUrl]);

  useEffect(() => {
    if (!layout || !selection) {
      return;
    }
    const hasUrl =
      (selection.kind === 'channel' && selection.channel.sendbirdChannelUrl) ||
      (selection.kind === 'dm' && selection.dm.sendbirdChannelUrl);
    if (hasUrl) {
      return;
    }
    const tmr = window.setInterval(() => {
      void reload();
    }, 4000);
    return () => window.clearInterval(tmr);
  }, [layout, reload, selection]);

  const sendMessage = useCallback(() => {
    const text = composer.trim();
    if (!groupChannel || !text) {
      return;
    }
    const pending = groupChannel.sendUserMessage({ message: text });
    pending.onPending((msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    pending.onFailed(() => {
      void reload();
    });
    pending.onSucceeded((msg) => {
      setMessages((prev) => {
        const i = prev.findIndex((m) => m.messageId === msg.messageId);
        if (i >= 0) {
          const next = [...prev];
          next[i] = msg;
          return next;
        }
        return [...prev, msg];
      });
    });
    setComposer('');
  }, [composer, groupChannel, reload]);

  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const filteredCategories = useMemo(() => {
    if (!layout) {
      return [];
    }
    const q = search.trim().toLowerCase();
    if (!q) {
      return layout.categories;
    }
    return layout.categories
      .map((c) => ({
        ...c,
        channels: c.channels.filter((ch) =>
          `${ch.name} ${ch.slug}`.toLowerCase().includes(q),
        ),
      }))
      .filter((c) => c.channels.length > 0);
  }, [layout, search]);

  const filteredDms = useMemo(() => {
    if (!layout) {
      return [];
    }
    const q = search.trim().toLowerCase();
    if (!q) {
      return layout.directThreads;
    }
    return layout.directThreads.filter((d) =>
      (d.title || '').toLowerCase().includes(q),
    );
  }, [layout, search]);

  const peerScopedIdForDm =
    selection?.kind === 'dm' && selection.dm.kind === 'direct'
      ? selection.dm.peerAgoraUserId
      : null;

  const handleVoiceDm = () => {
    if (!callsReady || !peerScopedIdForDm) {
      return;
    }
    const localEl = localVideoRef.current;
    const remoteEl = remoteVideoRef.current;
    if (!localEl || !remoteEl) {
      return;
    }
    try {
      const call = SendBirdCall.dial({
        userId: peerScopedIdForDm,
        isVideoCall: false,
        callOption: {
          audioEnabled: true,
          videoEnabled: false,
          localMediaView: localEl,
          remoteMediaView: remoteEl,
        },
      });
      call.onEnded = () => setOutgoingCall(null);
      setOutgoingCall(call);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : String(e));
    }
  };

  const attachGroupRoomMedia = async (room: SendBirdCall.Room) => {
    const localEl = localVideoRef.current;
    const remoteEl = remoteVideoRef.current;
    if (localEl) {
      await room.localParticipant.setLocalMediaView(localEl);
    }
    const firstRemote = room.remoteParticipants[0];
    if (remoteEl && firstRemote) {
      await firstRemote.setMediaView(remoteEl);
    }
  };

  const handleCreateGroupRoom = async () => {
    if (!callsReady) {
      return;
    }
    try {
      const room = await SendBirdCall.createRoom({
        roomType: SendBirdCall.RoomType.LARGE_ROOM_FOR_AUDIO_ONLY,
      });
      setGroupRoomIdInput(room.roomId);
      await room.enter({
        audioEnabled: true,
        videoEnabled: true,
        kickSiblings: true,
      });
      setActiveGroupRoom(room);
      await attachGroupRoomMedia(room);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleJoinGroupRoom = async () => {
    const id = groupRoomIdInput.trim();
    if (!callsReady || !id) {
      return;
    }
    try {
      const room = await SendBirdCall.fetchRoomById(id);
      await room.enter({
        audioEnabled: true,
        videoEnabled: true,
        kickSiblings: true,
      });
      setActiveGroupRoom(room);
      await attachGroupRoomMedia(room);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleLeaveGroupRoom = () => {
    activeGroupRoom?.exit();
    setActiveGroupRoom(null);
  };

  const handleAcceptIncoming = () => {
    if (!incomingCall) {
      return;
    }
    const localEl = localVideoRef.current;
    const remoteEl = remoteVideoRef.current;
    if (!localEl || !remoteEl) {
      return;
    }
    incomingCall.accept({
      callOption: {
        audioEnabled: true,
        videoEnabled: incomingCall.isVideoCall,
        localMediaView: localEl,
        remoteMediaView: remoteEl,
      },
    });
    setOutgoingCall(incomingCall);
    incomingCall.onEnded = () => {
      setOutgoingCall(null);
      setIncomingCall(null);
    };
    setIncomingCall(null);
  };

  const handleDeclineIncoming = () => {
    incomingCall?.end();
    setIncomingCall(null);
  };

  const directCallActive = !!(outgoingCall && outgoingCall.isOngoing);
  const showVideoPreview =
    directCallActive || !!incomingCall || !!activeGroupRoom;

  if (layoutLoading && !layout) {
    return <StyledMuted>{t`Loading workspace…`}</StyledMuted>;
  }

  if (layoutError) {
    return <StyledError>{layoutError}</StyledError>;
  }

  return (
    <StyledRoot>
      <StyledSidebar>
        <StyledSidebarHeader>
          <SearchInput
            placeholder={t`Search channels…`}
            value={search}
            onChange={setSearch}
          />
          <Button
            accent="blue"
            variant="primary"
            title={t`New channel`}
            onClick={() => setCreateChannelOpen(true)}
            Icon={IconPlus}
          />
          <Button
            variant="secondary"
            title={t`New DM`}
            onClick={() => setDmModalOpen(true)}
            Icon={IconUsers}
          />
        </StyledSidebarHeader>
        <StyledSidebarScroll>
          {filteredCategories.map((cat) => (
            <div key={cat.id}>
              <StyledCategoryLabel>{cat.name}</StyledCategoryLabel>
              {cat.channels.map((ch) => (
                <StyledChannelButton
                  key={ch.id}
                  type="button"
                  $active={
                    selection?.kind === 'channel' &&
                    selection.channel.id === ch.id
                  }
                  onClick={() => setSelection({ kind: 'channel', channel: ch })}
                >
                  {ch.visibility === 'public' ? (
                    <IconWorld size="small" />
                  ) : (
                    <IconUsers size="small" />
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ch.name}
                  </span>
                </StyledChannelButton>
              ))}
            </div>
          ))}
          <StyledCategoryLabel>{t`Direct messages`}</StyledCategoryLabel>
          {filteredDms.map((dm) => (
            <StyledChannelButton
              key={dm.id}
              type="button"
              $active={selection?.kind === 'dm' && selection.dm.id === dm.id}
              onClick={() => setSelection({ kind: 'dm', dm })}
            >
              <Avatar
                placeholder={dm.title || t`DM`}
                placeholderColorSeed={dm.id}
                size="sm"
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {dm.title || t`Direct message`}
              </span>
            </StyledChannelButton>
          ))}
        </StyledSidebarScroll>
      </StyledSidebar>

      <StyledMain>
        <StyledMainHeader>
          <StyledTitleBlock>
            <StyledTitle>
              {selection ? selectionTitle(selection) : t`Chat`}
            </StyledTitle>
            {channelUrl ? (
              <StyledSub>{channelUrl}</StyledSub>
            ) : selection ? (
              <StyledSub>
                {t`Waiting for Sendbird channel URL (server provisioning)…`}
              </StyledSub>
            ) : null}
          </StyledTitleBlock>
          <StyledCallActions>
            {selection?.kind === 'dm' &&
            selection.dm.kind === 'direct' &&
            peerScopedIdForDm ? (
              <Button
                accent="blue"
                disabled={!callsReady}
                title={t`Voice call`}
                variant="secondary"
                onClick={handleVoiceDm}
                Icon={IconPhone}
              />
            ) : null}
            {selection?.kind === 'channel' ? (
              <>
                <Button
                  accent="blue"
                  disabled={!callsReady}
                  title={t`Start group room`}
                  variant="secondary"
                  onClick={() => void handleCreateGroupRoom()}
                  Icon={IconUsers}
                />
              </>
            ) : null}
          </StyledCallActions>
        </StyledMainHeader>

        {connectError ? <StyledError>{connectError}</StyledError> : null}

        {!sb ? (
          <StyledMuted>{t`Connecting to Sendbird…`}</StyledMuted>
        ) : !channelUrl ? (
          <StyledMuted>
            {selection
              ? t`This conversation is not linked to Sendbird yet. Create it again or wait for provisioning.`
              : t`Select a channel or direct message.`}
          </StyledMuted>
        ) : (
          <>
            <StyledMessages>
              {messages.map((m) => {
                const sid = senderUserId(m);
                const own = sid === sessionUserIdRef.current;
                return (
                  <StyledMessageRow key={m.messageId} $own={!!own}>
                    <div>{messageBody(m)}</div>
                    <StyledMessageMeta>
                      {formatDistanceToNow(m.createdAt, { addSuffix: true })}
                    </StyledMessageMeta>
                  </StyledMessageRow>
                );
              })}
            </StyledMessages>
            <StyledComposer>
              <StyledTextarea
                placeholder={t`Message`}
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                onKeyDown={onComposerKeyDown}
                disabled={!groupChannel}
              />
              <Button
                accent="blue"
                disabled={!groupChannel || !composer.trim()}
                title={t`Send`}
                variant="primary"
                onClick={sendMessage}
                Icon={IconSend}
              />
            </StyledComposer>
          </>
        )}

        {selection?.kind === 'channel' ? (
          <StyledGroupCallBar>
            <input
              value={groupRoomIdInput}
              onChange={(e) => setGroupRoomIdInput(e.target.value)}
              placeholder={t`Room ID`}
              style={{
                flex: '1 1 160px',
                minWidth: 120,
                padding: '8px 10px',
                borderRadius: 6,
                border: `1px solid ${themeCssVariables.border.color.medium}`,
              }}
            />
            <Button
              accent="blue"
              disabled={!callsReady}
              title={t`Join room`}
              variant="secondary"
              onClick={() => void handleJoinGroupRoom()}
            />
            {activeGroupRoom ? (
              <Button
                title={t`Leave room`}
                variant="secondary"
                onClick={handleLeaveGroupRoom}
              />
            ) : null}
          </StyledGroupCallBar>
        ) : null}

      </StyledMain>

      <StyledVideoDock $expanded={showVideoPreview} aria-hidden={!showVideoPreview}>
        <video ref={localVideoRef} autoPlay playsInline muted />
        <video ref={remoteVideoRef} autoPlay playsInline />
      </StyledVideoDock>

      <CreateChannelModal
        isOpen={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        token={crmToken}
        layout={layout}
        onCreated={(channelId) => {
          setPendingChannelId(channelId);
          void reload();
        }}
        onLayoutRefresh={() => void reload()}
      />

      <NewDmModal
        isOpen={dmModalOpen}
        onClose={() => setDmModalOpen(false)}
        token={crmToken}
        viewerUserWorkspaceId={viewerUserWorkspaceId}
        onCreated={(threadId) => {
          setPendingDmThreadId(threadId);
          void reload();
        }}
        onLayoutRefresh={() => void reload()}
      />

      {incomingCall ? (
        <StyledIncomingBackdrop role="dialog" aria-modal="true">
          <StyledIncomingPanel>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              {t`Incoming call`}
            </div>
            <div style={{ fontSize: 13, marginBottom: 16 }}>
              {incomingCall.caller.userId}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button
                title={t`Decline`}
                variant="secondary"
                onClick={handleDeclineIncoming}
              />
              <Button
                accent="blue"
                title={t`Accept`}
                variant="primary"
                onClick={handleAcceptIncoming}
              />
            </div>
          </StyledIncomingPanel>
        </StyledIncomingBackdrop>
      ) : null}
    </StyledRoot>
  );
};
