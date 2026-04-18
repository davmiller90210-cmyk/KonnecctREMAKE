/* eslint-disable twenty/no-state-useref -- Sendbird SDK needs stable DOM/session refs across async handlers */
import SendbirdChat, {
  SessionHandler,
  type SendbirdChatWith,
} from '@sendbird/chat';
import {
  GroupChannelHandler,
  GroupChannelModule,
  type GroupChannel,
} from '@sendbird/chat/groupChannel';
import { type BaseMessage } from '@sendbird/chat/message';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import * as SendBirdCall from 'sendbird-calls';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { chatUnreadMapState } from '@/chat/states/chatUnreadState';
import {
  notifyIncomingChatIfBackground,
  registerSendbirdWebPushWhenPossible,
} from '@/chat/utils/chat-desktop-notify';
import { getMentionedUserIds } from '@/chat/utils/parseChatMessage';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { REACT_APP_SENDBIRD_APP_ID } from '~/config';

type SendbirdClient = SendbirdChatWith<[GroupChannelModule]>;

type SendbirdSessionResponse = {
  appId: string;
  userId: string;
  sessionToken: string;
  expiresAt?: number;
};

const APP_LEVEL_HANDLER_KEY = 'konnecct-sendbird-app-handler';

type ActiveChannelContext = {
  url: string | null;
};

type SendbirdClientContextValue = {
  sb: SendbirdClient | null;
  callsReady: boolean;
  sessionUserId: string | null;
  connectError: string | null;
  /** The route's currently-focused channel URL — suppresses unread counting & snackbars while viewing. */
  activeChannelRef: MutableRefObject<ActiveChannelContext>;
  setActiveChannelUrl: (url: string | null) => void;
  /** Reconnect after an explicit failure (e.g. bad session). */
  retry: () => void;
};

const SendbirdClientContext = createContext<SendbirdClientContextValue | null>(
  null,
);

const fetchSendbirdSession = async (
  bearer: string,
): Promise<SendbirdSessionResponse> => {
  const response = await fetch('/sendbird/session', {
    headers: { Authorization: `Bearer ${bearer}` },
  });

  const text = await response.text();

  if (!response.ok) {
    let msg = text.trim() || `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(parsed.message)) {
        msg = parsed.message.join('. ');
      } else if (typeof parsed.message === 'string') {
        msg = parsed.message;
      }
    } catch {
      // keep plain-text body
    }
    throw new Error(msg);
  }

  return JSON.parse(text) as SendbirdSessionResponse;
};

export const SendbirdClientProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const tokenPair = useAtomValue(tokenPairState.atom);
  const crmToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  const [sb, setSb] = useState<SendbirdClient | null>(null);
  const [callsReady, setCallsReady] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const setUnreadMap = useSetAtom(chatUnreadMapState.atom);
  const { enqueueInfoSnackBar } = useSnackBar();

  const activeChannelRef = useRef<ActiveChannelContext>({ url: null });
  const sessionUserIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | undefined>(crmToken);
  tokenRef.current = crmToken;
  sessionUserIdRef.current = sessionUserId;

  const setActiveChannelUrl = useCallback((url: string | null) => {
    activeChannelRef.current = { url };

    if (url) {
      setUnreadMap((prev) => {
        if (!(url in prev)) {
          return prev;
        }
        const next = { ...prev };
        next[url] = 0;
        return next;
      });
    }
  }, [setUnreadMap]);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!crmToken) {
      setSb(null);
      setCallsReady(false);
      setSessionUserId(null);
      return;
    }

    let cancelled = false;

    const connect = async () => {
      setConnectError(null);
      try {
        const session = await fetchSendbirdSession(crmToken);
        if (cancelled) return;

        const appId = session.appId?.trim() || REACT_APP_SENDBIRD_APP_ID.trim();
        if (!appId) {
          throw new Error(
            'Sendbird app id missing (server SENDBIRD_APPLICATION_ID or REACT_APP_SENDBIRD_APP_ID).',
          );
        }

        const instance = SendbirdChat.init({
          appId,
          modules: [new GroupChannelModule()],
        }) as SendbirdClient;

        const sessionHandler = new SessionHandler({
          onSessionTokenRequired: (resolve, reject) => {
            void (async () => {
              try {
                const token = tokenRef.current;
                if (!token) {
                  throw new Error('Missing auth token');
                }
                const refreshed = await fetchSendbirdSession(token);
                resolve(refreshed.sessionToken);
              } catch (err) {
                reject(err instanceof Error ? err : new Error(String(err)));
              }
            })();
          },
        });
        instance.setSessionHandler(sessionHandler);

        await instance.connect(session.userId, session.sessionToken);

        if (cancelled) {
          await instance.disconnect().catch(() => {});
          return;
        }

        setSessionUserId(session.userId);
        setSb(instance);

        try {
          SendBirdCall.init(appId);
          await SendBirdCall.authenticate({
            userId: session.userId,
            accessToken: session.sessionToken,
          });
          await SendBirdCall.connectWebSocket();
          setCallsReady(true);
        } catch {
          setCallsReady(false);
        }

        const syncUnreadMapFromSendbird = async () => {
          try {
            const query = instance.groupChannel.createMyGroupChannelListQuery({
              limit: 100,
            });
            const map: Record<string, number> = {};
            let hasMore = true;
            while (hasMore) {
              const channels = await query.next();
              for (const ch of channels) {
                map[ch.url] = ch.unreadMessageCount;
              }
              hasMore = query.hasNext;
            }
            setUnreadMap(map);
          } catch {
            /* noop */
          }
        };

        const appHandler = new GroupChannelHandler({
          onMessageReceived: (channel, message) => {
            void (async () => {
              const activeUrl = activeChannelRef.current.url;
              const isViewingChannel =
                channel.url === activeUrl && !document.hidden;

              try {
                const fresh = await instance.groupChannel.getChannel(
                  channel.url,
                );
                if (!isViewingChannel) {
                  setUnreadMap((prev) => ({
                    ...prev,
                    [channel.url]: fresh.unreadMessageCount,
                  }));
                } else {
                  setUnreadMap((prev) => ({
                    ...prev,
                    [channel.url]: 0,
                  }));
                }
              } catch {
                if (!isViewingChannel) {
                  setUnreadMap((prev) => ({
                    ...prev,
                    [channel.url]: (prev[channel.url] ?? 0) + 1,
                  }));
                }
              }

              if (!sessionUserIdRef.current) return;

              const body = (message as unknown as { message?: string }).message;
              if (!body) return;

              const mentioned = getMentionedUserIds(body);
              if (mentioned.includes(sessionUserIdRef.current)) {
                if (!isViewingChannel) {
                  enqueueInfoSnackBar({
                    message: body.slice(0, 140),
                  });
                }
              }

              if (document.hidden) {
                notifyIncomingChatIfBackground({
                  title: channel.name || 'New message',
                  body: body.slice(0, 140),
                });
              }
            })();
          },
        });

        instance.groupChannel.addGroupChannelHandler(
          APP_LEVEL_HANDLER_KEY,
          appHandler,
        );

        void syncUnreadMapFromSendbird();
        void registerSendbirdWebPushWhenPossible();
      } catch (error) {
        if (cancelled) return;
        setConnectError(
          error instanceof Error ? error.message : 'Unable to connect to chat',
        );
      }
    };

    void connect();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crmToken, attempt]);

  useEffect(() => {
    return () => {
      if (sb) {
        sb.groupChannel.removeGroupChannelHandler(APP_LEVEL_HANDLER_KEY);
        void sb.disconnect().catch(() => {});
      }
      if (callsReady) {
        try {
          SendBirdCall.deauthenticate();
        } catch {
          /* noop */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  const value = useMemo<SendbirdClientContextValue>(
    () => ({
      sb,
      callsReady,
      sessionUserId,
      connectError,
      activeChannelRef,
      setActiveChannelUrl,
      retry,
    }),
    [sb, callsReady, sessionUserId, connectError, setActiveChannelUrl, retry],
  );

  return (
    <SendbirdClientContext.Provider value={value}>
      {children}
    </SendbirdClientContext.Provider>
  );
};

export const useSendbirdClient = () => {
  const ctx = useContext(SendbirdClientContext);
  if (!ctx) {
    throw new Error(
      'useSendbirdClient must be used within SendbirdClientProvider',
    );
  }
  return ctx;
};

export const useSendbirdClientOptional = () =>
  useContext(SendbirdClientContext);

export type { BaseMessage, GroupChannel, SendbirdClient };
