/* eslint-disable twenty/no-state-useref -- Sendbird/Calls SDK needs stable DOM refs and mirrored channel/session handles inside async handlers */
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { useAtomValue } from 'jotai';
import { format, isSameDay } from 'date-fns';
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
  ReplyType,
  type BaseMessage,
  type FileMessage,
  type Member,
  type UserMessage,
} from '@sendbird/chat/message';
import * as SendBirdCall from 'sendbird-calls';
import { Button } from 'twenty-ui/input';
import {
  Avatar,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhone,
  IconPhoneOff,
  IconScreenShare,
  IconSend,
  IconSparkles,
  IconVideo,
  IconVideoOff,
  IconX,
  IconBell,
  IconClock,
  IconHelp,
  IconSearch as IconSearchHeader,
} from 'twenty-ui/display';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { CreateChannelModal } from '@/chat/components/CreateChannelModal';
import { NewDmModal } from '@/chat/components/NewDmModal';
import { useChatWorkspaceLayout } from '@/chat/hooks/useChatWorkspaceLayout';
import {
  COLLAB_NOTE_CUSTOM_TYPE,
  filterMainFeedMessages,
  isCollabNoteMessage,
} from '@/chat/sendbird/collabNote';
import { upsertMessage } from '@/chat/sendbird/messageDedup';
import { EditorialDetailsPanel } from '@/chat/sendbird-suite/EditorialDetailsPanel';
import { EditorialWorkspaceRail } from '@/chat/sendbird-suite/EditorialWorkspaceRail';
import * as Ed from '@/chat/sendbird-suite/editorialLayout';
import { editorialChatTheme } from '@/chat/theme/editorialChatTheme';
import {
  type ChatHubSelection,
  type ChatWorkspaceLayoutDm,
  type ChatWorkspaceMemberOption,
} from '@/chat/types/chat-workspace-layout.type';
import { useCrmMentionSearch } from '@/chat/hooks/useCrmMentionSearch';
import { useCallOverlayOptional } from '@/chat/contexts/CallOverlayContext';
import {
  KonnecctAIPanelProvider,
  useKonnecctAIPanel,
  type KonnecctAIChannelContext,
} from '@/chat/contexts/KonnecctAIPanelContext';
import { KonnecctAIPanel } from '@/chat/components/KonnecctAIPanel';
import { AppPath } from 'twenty-shared/types';
import { getAppPath } from 'twenty-shared/utils';
import { REACT_APP_SENDBIRD_APP_ID } from '~/config';

type SendbirdClient = SendbirdChatWith<[GroupChannelModule]>;

const HANDLER_KEY = 'konnecct-sendbird-hub';
const CALL_LISTENER_KEY = 'konnecct-sendbird-calls';
const ACTIVE_GROUP_CALL_ROOM_METADATA_KEY = 'konnecct_active_group_call_room_id';

const REACTION_EMOJI = ['\u{1F680}', '\u{2728}'] as const;

type SendbirdSessionResponse = {
  appId: string;
  userId: string;
  sessionToken: string;
  expiresAt?: number;
};

async function fetchSendbirdSession(
  bearer: string,
): Promise<SendbirdSessionResponse> {
  const response = await fetch('/sendbird/session', {
    headers: { Authorization: `Bearer ${bearer}` },
  });

  const text = await response.text();

  if (!response.ok) {
    let msg = text.trim() || `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text) as {
        message?: string | string[];
      };
      if (Array.isArray(parsed.message)) {
        msg = parsed.message.join('. ');
      } else if (typeof parsed.message === 'string') {
        msg = parsed.message;
      }
    } catch {
      // keep plain-text body
    }
    if (msg.length > 420) {
      msg = `${msg.slice(0, 420)}…`;
    }
    throw new Error(msg);
  }

  return JSON.parse(text) as SendbirdSessionResponse;
}

function memberDisplayName(m: ChatWorkspaceMemberOption): string {
  const name = [m.firstName, m.lastName].filter(Boolean).join(' ').trim();
  return name || m.email || m.streamUserId;
}

function selectionTitle(sel: ChatHubSelection | null): string {
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
    return (m as UserMessage).message;
  }
  if (m.messageType === MessageType.FILE) {
    return (m as FileMessage).name || t`File`;
  }
  if (m.messageType === MessageType.ADMIN) {
    return m.message || t`System`;
  }
  return t`Message`;
}

function isThreadChild(m: BaseMessage): boolean {
  return m.parentMessageId > 0;
}

function isImageFileMessage(m: FileMessage): boolean {
  return (
    m.type.startsWith('image/') ||
    (m.thumbnails?.length ?? 0) > 0
  );
}

/** Inner component — must be rendered inside KonnecctAIPanelProvider */
const SendbirdCommunicationHubInner = () => {
  const tokenPair = useAtomValue(tokenPairState.atom);
  const crmToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const currentWorkspace = useAtomValue(currentWorkspaceState.atom);

  const { layout, isLoading: layoutLoading, error: layoutError, reload } =
    useChatWorkspaceLayout();

  const [connectError, setConnectError] = useState<string | null>(null);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [sb, setSb] = useState<SendbirdClient | null>(null);
  const [callsReady, setCallsReady] = useState(false);
  const sessionUserIdRef = useRef<string | null>(null);
  const fetchSessionRef = useRef<() => Promise<string>>(async () => '');

  const [selection, setSelection] = useState<ChatHubSelection | null>(null);
  const [pendingDmThreadId, setPendingDmThreadId] = useState<string | null>(
    null,
  );
  const [pendingChannelId, setPendingChannelId] = useState<string | null>(
    null,
  );
  const [channelUrl, setChannelUrl] = useState<string | null>(null);
  const [groupChannel, setGroupChannel] = useState<GroupChannel | null>(null);
  const groupChannelRef = useRef<GroupChannel | null>(null);
  groupChannelRef.current = groupChannel;

  const [messages, setMessages] = useState<BaseMessage[]>([]);
  const [noteMessages, setNoteMessages] = useState<UserMessage[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<
    { messageId: number; preview: string }[]
  >([]);
  const [typingMembers, setTypingMembers] = useState<Member[]>([]);
  const [composer, setComposer] = useState('');
  const [threadComposer, setThreadComposer] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [search, setSearch] = useState('');
  const [mainSearch, setMainSearch] = useState('');

  // CRM @mention state
  type CrmMention =
    | { kind: 'crm'; label: string; href: string }
    | { kind: 'agent'; label: string; recordId: string }
    | { kind: 'konnecctai'; label: string; recordId: string };
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionItems, setMentionItems] = useState<CrmMention[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { searchMentionRecords } = useCrmMentionSearch();
  const callOverlay = useCallOverlayOptional();
  const aiPanel = useKonnecctAIPanel();

  const [threadRoot, setThreadRoot] = useState<BaseMessage | null>(null);
  const [threadReplies, setThreadReplies] = useState<BaseMessage[]>([]);

  useEffect(() => {
    if (!threadRoot) {
      return;
    }
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setThreadRoot(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [threadRoot]);

  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [dmModalOpen, setDmModalOpen] = useState(false);

  const [activeGroupRoom, setActiveGroupRoom] = useState<
    SendBirdCall.Room | null
  >(null);

  const [incomingCall, setIncomingCall] = useState<SendBirdCall.DirectCall | null>(
    null,
  );
  const [outgoingCall, setOutgoingCall] = useState<SendBirdCall.DirectCall | null>(
    null,
  );
  const [, refreshCallUi] = useReducer((x: number) => x + 1, 0);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const threadTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeChannelUrlRef = useRef<string | null>(null);
  activeChannelUrlRef.current = channelUrl;

  const sbInstanceRef = useRef<SendbirdClient | null>(null);

  const viewerUserWorkspaceId = layout?.viewer.userWorkspaceId;
  const isWorkspaceAdmin = layout?.viewer.isWorkspaceAdmin === true;

  const [workspaceMembers, setWorkspaceMembers] = useState<
    ChatWorkspaceMemberOption[]
  >([]);
  const sendbirdBulkEnsuredKeyRef = useRef<string>('');

  const workspaceTitle =
    currentWorkspace?.displayName?.trim() || t`Workspace`;
  const planLabel =
    currentWorkspace?.currentBillingSubscription?.billingSubscriptionItems?.[0]
      ?.billingProduct?.name ?? null;

  useEffect(() => {
    if (!crmToken) {
      setWorkspaceMembers([]);
      sendbirdBulkEnsuredKeyRef.current = '';
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch('/chat/workspace-members', {
          headers: { Authorization: `Bearer ${crmToken}` },
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as ChatWorkspaceMemberOption[];

        if (!cancelled) {
          setWorkspaceMembers(data);
        }
      } catch {
        if (!cancelled) {
          setWorkspaceMembers([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [crmToken]);

  useEffect(() => {
    if (!crmToken || workspaceMembers.length === 0 || !layout) {
      return;
    }

    const key = `${layout.viewer.userWorkspaceId}:${workspaceMembers
      .map((m) => m.streamUserId)
      .sort()
      .join(',')}`;

    if (sendbirdBulkEnsuredKeyRef.current === key) {
      return;
    }

    sendbirdBulkEnsuredKeyRef.current = key;

    void (async () => {
      const ids = workspaceMembers.map((m) => m.streamUserId);
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        try {
          const res = await fetch('/sendbird/ensure-users', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${crmToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ scopedUserIds: chunk }),
          });

          if (!res.ok) {
            sendbirdBulkEnsuredKeyRef.current = '';
            return;
          }
        } catch {
          sendbirdBulkEnsuredKeyRef.current = '';
          return;
        }
      }
    })();
  }, [crmToken, layout, workspaceMembers]);

  const memberByScopedId = useMemo(() => {
    const map = new Map<string, ChatWorkspaceMemberOption>();

    for (const m of workspaceMembers) {
      map.set(m.streamUserId, m);
    }

    return map;
  }, [workspaceMembers]);

  const viewerMember = useMemo(() => {
    if (!viewerUserWorkspaceId) {
      return null;
    }

    return (
      workspaceMembers.find(
        (m) => m.userWorkspaceId === viewerUserWorkspaceId,
      ) ?? null
    );
  }, [viewerUserWorkspaceId, workspaceMembers]);

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
      setSessionAttempt(0);
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
            if (ch.url !== activeChannelUrlRef.current) {
              return;
            }
            if (isCollabNoteMessage(message)) {
              setNoteMessages((prev) => [...prev, message as UserMessage]);
              return;
            }
            if (isThreadChild(message)) {
              return;
            }
            setMessages((prev) => {
              return filterMainFeedMessages(upsertMessage(prev, message));
            });
          },
          onMessageUpdated: (ch, message) => {
            if (ch.url !== activeChannelUrlRef.current) {
              return;
            }
            if (isCollabNoteMessage(message)) {
              setNoteMessages((prev) =>
                prev.map((m) =>
                  m.messageId === message.messageId ? (message as UserMessage) : m,
                ),
              );
              return;
            }
            setMessages((prev) => upsertMessage(prev, message));
          },
          onMessageDeleted: (ch, messageId) => {
            if (ch.url !== activeChannelUrlRef.current) {
              return;
            }
            setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
            setNoteMessages((prev) =>
              prev.filter((m) => m.messageId !== messageId),
            );
          },
          onReactionUpdated: (_ch, reactionEvent) => {
            if (_ch.url !== activeChannelUrlRef.current) {
              return;
            }
            setMessages((prev) => {
              const next = [...prev];
              const idx = next.findIndex(
                (m) => m.messageId === reactionEvent.messageId,
              );
              if (idx >= 0) {
                next[idx].applyReactionEvent(reactionEvent);
              }
              return next;
            });
            setThreadReplies((prev) => {
              const next = [...prev];
              const idx = next.findIndex(
                (m) => m.messageId === reactionEvent.messageId,
              );
              if (idx >= 0) {
                next[idx].applyReactionEvent(reactionEvent);
              }
              return next;
            });
          },
          onThreadInfoUpdated: (ch, ev) => {
            if (ch.url !== activeChannelUrlRef.current) {
              return;
            }
            setMessages((prev) => {
              const next = [...prev];
              const idx = next.findIndex(
                (m) => m.messageId === ev.targetMessageId,
              );
              if (idx >= 0) {
                next[idx].applyThreadInfoUpdateEvent(ev);
              }
              return next;
            });
          },
          onTypingStatusUpdated: (ch) => {
            if (ch.url !== activeChannelUrlRef.current) {
              return;
            }
            setTypingMembers(ch.getTypingUsers());
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
  }, [crmToken, sessionAttempt]);

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
      setNoteMessages([]);
      setPinnedMessages([]);
      setTypingMembers([]);
      setThreadRoot(null);
      setThreadReplies([]);
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
          limit: 80,
          reverse: true,
          messageTypeFilter: MessageTypeFilter.ALL,
          replyType: ReplyType.NONE,
          includeReactions: true,
          includeThreadInfo: true,
        });
        const loaded = await query.load();
        if (cancelled) {
          return;
        }
        setMessages(filterMainFeedMessages([...loaded].reverse()));

        const noteQuery = ch.createPreviousMessageListQuery({
          limit: 40,
          reverse: true,
          messageTypeFilter: MessageTypeFilter.USER,
          customTypesFilter: [COLLAB_NOTE_CUSTOM_TYPE],
        });
        const notesLoaded = await noteQuery.load();
        if (cancelled) {
          return;
        }
        setNoteMessages(
          [...notesLoaded].reverse().filter(isCollabNoteMessage) as UserMessage[],
        );

        const pinQ = ch.createPinnedMessageListQuery({ limit: 12 });
        const pins = await pinQ.next();
        if (cancelled) {
          return;
        }
        setPinnedMessages(
          pins
            .map((p) => p.message)
            .filter((m): m is BaseMessage => !!m)
            .map((m) => ({
              messageId: m.messageId,
              preview: messageBody(m).slice(0, 120),
            })),
        );
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
      (selection.kind === 'channel' &&
        Boolean(selection.channel.sendbirdChannelUrl)) ||
      (selection.kind === 'dm' && Boolean(selection.dm.sendbirdChannelUrl));
    if (hasUrl) {
      return;
    }
    const tmr = window.setInterval(() => {
      void reload();
    }, 4000);
    return () => window.clearInterval(tmr);
  }, [layout, reload, selection]);

  useEffect(() => {
    if (!threadRoot || groupChannel == null) {
      setThreadReplies([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const res = await threadRoot.getThreadedMessagesByTimestamp(
          threadRoot.createdAt,
          {
            prevResultSize: 60,
            nextResultSize: 0,
            reverse: true,
            includeReactions: true,
          },
        );
        if (cancelled) {
          return;
        }
        setThreadReplies([...res.threadedMessages].reverse());
      } catch {
        if (!cancelled) {
          setThreadReplies([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [threadRoot, groupChannel]);

  const typingThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fireTyping = useCallback(() => {
    const ch = groupChannelRef.current;
    if (!ch) {
      return;
    }
    void ch.startTyping().catch(() => undefined);
    if (typingThrottleRef.current) {
      clearTimeout(typingThrottleRef.current);
    }
    typingThrottleRef.current = setTimeout(() => {
      void ch.endTyping().catch(() => undefined);
      typingThrottleRef.current = null;
    }, 2800);
  }, []);

  const sendMainMessage = useCallback(() => {
    const text = composer.trim();
    const ch = groupChannelRef.current;
    if (!text) return;

    // ─── @KonnecctAI intercept ───────────────────────────────────────────
    // If the message starts with @KonnecctAI (case-insensitive), strip that
    // prefix, build chat context, open the AI panel and inject the query.
    const aiMatch = /^@KonnecctAI\b\s*/i.exec(text);
    if (aiMatch) {
      const query = text.slice(aiMatch[0].length).trim();

      // Build rich channel context for the AI
      const members = groupChannel?.members ?? [];
      const recentMsgs = messages.slice(-20).map((m) => ({
        author:
          senderUserId(m)
            ? (memberByScopedId.get(senderUserId(m)!)
                ? memberDisplayName(memberByScopedId.get(senderUserId(m)!)!)
                : (senderUserId(m) ?? 'Member'))
            : 'Member',
        body: messageBody(m).slice(0, 300),
        ts: m.createdAt,
      }));

      const channelCtx: KonnecctAIChannelContext = {
        channelUrl,
        channelName:
          selection?.kind === 'channel'
            ? selection.channel.name
            : selection?.kind === 'dm'
              ? (selection.dm.title?.trim() ?? 'Direct message')
              : '',
        kind: selection?.kind ?? null,
        memberNames: members
          .slice(0, 40)
          .map(
            (mem) =>
              [mem.nickname, mem.userId].find(Boolean) ?? mem.userId,
          ),
        recentMessages: recentMsgs,
      };
      aiPanel.setChannelContext(channelCtx);

      // Build the full question with injected context preamble
      const contextLines: string[] = [];
      if (channelCtx.channelName) {
        contextLines.push(
          `[Current channel: ${channelCtx.kind === 'channel' ? '#' : ''}${channelCtx.channelName}]`,
        );
      }
      if (channelCtx.memberNames.length) {
        contextLines.push(
          `[Members: ${channelCtx.memberNames.slice(0, 10).join(', ')}${channelCtx.memberNames.length > 10 ? ` (+${channelCtx.memberNames.length - 10} more)` : ''}]`,
        );
      }
      if (recentMsgs.length) {
        const snippet = recentMsgs
          .slice(-5)
          .map((m) => `${m.author}: ${m.body}`)
          .join('\n');
        contextLines.push(`[Recent messages:\n${snippet}]`);
      }
      const fullQuery = contextLines.length
        ? `${contextLines.join('\n')}\n\n${query || 'Summarize the recent conversation above.'}`
        : (query || 'Hello');

      aiPanel.open(fullQuery);
      setComposer('');
      void ch?.endTyping().catch(() => undefined);
      return;
    }
    // ─────────────────────────────────────────────────────────────────────

    if (!ch) return;
    const pending = ch.sendUserMessage({ message: text });
    pending.onPending((msg) => {
      setMessages((prev) => filterMainFeedMessages(upsertMessage(prev, msg)));
    });
    pending.onFailed(() => {
      void reload();
    });
    pending.onSucceeded((msg) => {
      setMessages((prev) => {
        return filterMainFeedMessages(upsertMessage(prev, msg));
      });
    });
    setComposer('');
    void ch.endTyping().catch(() => undefined);
  }, [composer, reload, aiPanel, selection, channelUrl, groupChannel, messages, memberByScopedId]);


  const sendThreadMessage = useCallback(() => {
    const text = threadComposer.trim();
    const ch = groupChannelRef.current;
    const root = threadRoot;
    if (!ch || !text || !root) {
      return;
    }
    const pending = ch.sendUserMessage({
      message: text,
      parentMessageId: root.messageId,
    });
    pending.onSucceeded((msg) => {
      setThreadReplies((prev) => upsertMessage(prev, msg));
    });
    pending.onFailed(() => void reload());
    setThreadComposer('');
  }, [threadComposer, threadRoot, reload]);

  const sendNote = useCallback(() => {
    const text = noteDraft.trim();
    const ch = groupChannelRef.current;
    if (!ch || !text) {
      return;
    }
    const pending = ch.sendUserMessage({
      message: text,
      customType: COLLAB_NOTE_CUSTOM_TYPE,
    });
    pending.onSucceeded((msg) => {
      setNoteMessages((prev) => [...prev, msg as UserMessage]);
    });
    pending.onFailed(() => void reload());
    setNoteDraft('');
  }, [noteDraft, reload]);

  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, mentionItems.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const item = mentionItems[mentionIndex];
        if (item) {
          applyMention(item);
        }
        return;
      }
      if (e.key === 'Escape') {
        setMentionOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMainMessage();
    }
  };

  const handleComposerChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setComposer(val);
    fireTyping();

    // CRM @mention detection
    const caret = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, caret);
    const atMatch = /@([\w\s]*)$/.exec(textBefore);
    if (atMatch) {
      const q = atMatch[1];
      setMentionStart(caret - atMatch[0].length);
      setMentionQuery(q);
      setMentionOpen(true);
      setMentionIndex(0);

      if (mentionDebounceRef.current) {
        clearTimeout(mentionDebounceRef.current);
      }
      mentionDebounceRef.current = setTimeout(() => {
        void (async () => {
          const results = await searchMentionRecords(q);
          const items = results.slice(0, 20).map((r) => {
            if (r.mentionType === 'agent') {
              return { kind: 'agent' as const, label: r.label, recordId: r.recordId };
            }
            const path = getAppPath(AppPath.RecordShowPage, {
              objectNameSingular: r.objectNameSingular,
              objectRecordId: r.recordId,
            });
            return {
              kind: 'crm' as const,
              label: r.label,
              href: `${window.location.origin}${path}`,
            };
          });

          // Always pin @KonnecctAI first when query matches "ko" / "konnecct" / "ai" or is empty
          const showKonnecctAI =
            q.length === 0 ||
            'konnecctai'.startsWith(q.toLowerCase()) ||
            'konnecct'.startsWith(q.toLowerCase()) ||
            'ai'.startsWith(q.toLowerCase());

          const konnecctAIItem = showKonnecctAI
            ? [{ kind: 'konnecctai' as const, label: 'KonnecctAI', recordId: '' }]
            : [];

          setMentionItems([...konnecctAIItem, ...items]);
        })();
      }, 180);

    } else {
      setMentionOpen(false);
      setMentionItems([]);
    }
  };

  const applyMention = (item: { kind: string; label: string; href?: string }) => {
    if (mentionStart === null) return;
    const before = composer.slice(0, mentionStart);
    const after = composer.slice(composerTextareaRef.current?.selectionStart ?? composer.length);

    if (item.kind === 'konnecctai') {
      // Pre-fill the composer with @KonnecctAI so the user types their question inline
      setComposer(`${before}@KonnecctAI ${after}`);
      setMentionOpen(false);
      setMentionItems([]);
      requestAnimationFrame(() => {
        const ta = composerTextareaRef.current;
        if (ta) {
          const pos = (before + '@KonnecctAI ').length;
          ta.setSelectionRange(pos, pos);
          ta.focus();
        }
      });
      return;
    }

    const chip = item.kind === 'crm' ? `[@${item.label}](${item.href ?? ''}) ` : `@${item.label} `;
    setComposer(before + chip + after);
    setMentionOpen(false);
    setMentionItems([]);
    requestAnimationFrame(() => {
      const ta = composerTextareaRef.current;
      if (ta) {
        const pos = (before + chip).length;
        ta.setSelectionRange(pos, pos);
        ta.focus();
      }
    });
  };

  const onThreadKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendThreadMessage();
    }
  };

  const insertAround = (
    ref: React.RefObject<HTMLTextAreaElement | null>,
    value: string,
    open: string,
    close: string,
  ) => {
    const ta = ref.current;
    if (!ta) {
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = value.slice(start, end);
    const next =
      value.slice(0, start) + open + sel + close + value.slice(end);
    return { next, caret: start + open.length + sel.length + close.length };
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

  const mainMessagesFiltered = useMemo(() => {
    const q = mainSearch.trim().toLowerCase();
    if (!q) {
      return messages;
    }
    return messages.filter((m) =>
      messageBody(m).toLowerCase().includes(q),
    );
  }, [messages, mainSearch]);

  const mediaThumbs = useMemo(() => {
    const imgs: { url: string; id: number }[] = [];
    for (let i = messages.length - 1; i >= 0 && imgs.length < 9; i--) {
      const m = messages[i];
      if (m.messageType === MessageType.FILE) {
        const fm = m as FileMessage;
        if (isImageFileMessage(fm)) {
          const url = fm.thumbnails?.[0]?.plainUrl || fm.plainUrl;
          if (url) {
            imgs.push({ url, id: fm.messageId });
          }
        }
      }
    }
    return imgs;
  }, [messages]);

  const peerScopedIdForDm =
    selection?.kind === 'dm' && selection.dm.kind === 'direct'
      ? selection.dm.peerAgoraUserId
      : null;

  const dmPeerMember = peerScopedIdForDm
    ? memberByScopedId.get(peerScopedIdForDm)
    : undefined;

  const dmRowMeta = useCallback(
    (dm: ChatWorkspaceLayoutDm) => {
      if (dm.kind === 'direct' && dm.peerAgoraUserId) {
        const peer = memberByScopedId.get(dm.peerAgoraUserId);
        if (peer) {
          return {
            avatarUrl: peer.avatarUrl,
            label: dm.title?.trim() || memberDisplayName(peer),
          };
        }
      }
      return {
        avatarUrl: null as string | null,
        label: dm.title?.trim() || t`Direct message`,
      };
    },
    [memberByScopedId],
  );

  const startDmCall = (video: boolean) => {
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
        isVideoCall: video,
        callOption: {
          audioEnabled: true,
          videoEnabled: video,
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
    if (remoteEl && firstRemote !== undefined) {
      await firstRemote.setMediaView(remoteEl);
    }
  };

  const getSharedGroupRoomId = async (): Promise<string | null> => {
    const ch = groupChannelRef.current;
    if (!ch) {
      return null;
    }

    const withMeta = ch as GroupChannel & {
      getMetaData?: (
        keys: string[],
      ) => Promise<Record<string, string | undefined>>;
    };

    if (withMeta.getMetaData === undefined) {
      return null;
    }

    try {
      const result = await withMeta.getMetaData([
        ACTIVE_GROUP_CALL_ROOM_METADATA_KEY,
      ]);
      const id = result[ACTIVE_GROUP_CALL_ROOM_METADATA_KEY]?.trim();
      return id || null;
    } catch {
      return null;
    }
  };

  const setSharedGroupRoomId = async (roomId: string) => {
    const ch = groupChannelRef.current;
    if (!ch) {
      return;
    }

    const withMeta = ch as GroupChannel & {
      updateMetaData?: (data: Record<string, string>) => Promise<unknown>;
      createMetaData?: (data: Record<string, string>) => Promise<unknown>;
    };

    try {
      if (withMeta.updateMetaData !== undefined) {
        await withMeta.updateMetaData({
          [ACTIVE_GROUP_CALL_ROOM_METADATA_KEY]: roomId,
        });
        return;
      }
    } catch {
      // fallback to createMetaData below
    }

    if (withMeta.createMetaData !== undefined) {
      await withMeta.createMetaData({
        [ACTIVE_GROUP_CALL_ROOM_METADATA_KEY]: roomId,
      });
    }
  };

  const handleCreateGroupRoom = async () => {
    if (!callsReady) {
      return;
    }
    try {
      const sharedRoomId = await getSharedGroupRoomId();
      let room: SendBirdCall.Room;

      if (sharedRoomId) {
        try {
          room = await SendBirdCall.fetchRoomById(sharedRoomId);
        } catch {
          room = await SendBirdCall.createRoom({
            roomType: SendBirdCall.RoomType.LARGE_ROOM_FOR_AUDIO_ONLY,
          });
          await setSharedGroupRoomId(room.roomId);
        }
      } else {
        room = await SendBirdCall.createRoom({
          roomType: SendBirdCall.RoomType.LARGE_ROOM_FOR_AUDIO_ONLY,
        });
        await setSharedGroupRoomId(room.roomId);
      }

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
  const activeCall = outgoingCall;

  const toggleMute = () => {
    if (!activeCall) {
      return;
    }
    if (activeCall.isLocalAudioEnabled) {
      activeCall.muteMicrophone();
    } else {
      activeCall.unmuteMicrophone();
    }
    refreshCallUi();
  };

  const toggleVideo = () => {
    if (!activeCall?.isVideoCall) {
      return;
    }
    if (activeCall.isLocalVideoEnabled) {
      activeCall.stopVideo();
    } else {
      activeCall.startVideo();
    }
    refreshCallUi();
  };

  const toggleScreenShare = () => {
    if (!activeCall) {
      return;
    }
    void (async () => {
      try {
        if (activeCall.isLocalScreenShareEnabled) {
          activeCall.stopScreenShare();
        } else {
          await activeCall.startScreenShare();
        }
      } catch {
        setConnectError(t`Screen share is not available`);
      }
    })();
  };

  const leaveDirectCall = () => {
    activeCall?.end();
    setOutgoingCall(null);
    setIncomingCall(null);
  };

  const handleFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const ch = groupChannelRef.current;
    e.target.value = '';
    if (!file || !ch) {
      return;
    }
    const pending = ch.sendFileMessage({ file });
    pending.onSucceeded((msg) => {
      setMessages((prev) => filterMainFeedMessages([...prev, msg]));
    });
    pending.onFailed(() => void reload());
  };

  const addReaction = (m: BaseMessage, key: string) => {
    const ch = groupChannelRef.current;
    if (!ch) {
      return;
    }
    void ch.addReaction(m, key).catch(() => undefined);
  };

  const pinMessage = (m: BaseMessage) => {
    const ch = groupChannelRef.current;
    if (!ch) {
      return;
    }
    void ch
      .pinMessage(m.messageId)
      .then(() => {
        setPinnedMessages((prev) => [
          {
            messageId: m.messageId,
            preview: messageBody(m).slice(0, 120),
          },
          ...prev.filter((p) => p.messageId !== m.messageId),
        ]);
      })
      .catch(() => undefined);
  };

  const leaveChannel = () => {
    const ch = groupChannelRef.current;
    if (!ch || selection?.kind !== 'channel') {
      return;
    }
    void ch.leave().then(() => {
      setSelection(null);
      void reload();
    });
  };

  const channelTopic =
    groupChannel?.data?.trim() ||
    (selection?.kind === 'channel' ? selection.channel.name : '');

  const renderMessageBlock = (m: BaseMessage, opts: { inThread?: boolean }) => {
    const sid = senderUserId(m);
    const own = sid === sessionUserIdRef.current;
    const member = sid ? memberByScopedId.get(sid) : undefined;
    const senderLabel = own
      ? t`You`
      : member
        ? memberDisplayName(member)
        : (sid ?? t`Member`);

    const replyCount =
      m.threadInfo?.replyCount && m.threadInfo.replyCount > 0
        ? m.threadInfo.replyCount
        : 0;

    return (
      <Ed.MsgRow key={`${opts.inThread ? 't' : 'm'}-${m.messageId}`} $own={!!own}>
        {!own && sid ? (
          <Avatar
            avatarUrl={member?.avatarUrl ?? null}
            placeholder={senderLabel}
            placeholderColorSeed={sid}
            size="sm"
          />
        ) : null}
        <Ed.MsgStack>
          <Ed.MsgMeta $own={!!own}>
            <Ed.MsgAuthor>{senderLabel}</Ed.MsgAuthor>
            <Ed.MsgTime>
              {format(m.createdAt, 'p')}
            </Ed.MsgTime>
          </Ed.MsgMeta>
          {m.messageType === MessageType.FILE ? (
            (() => {
              const fm = m as FileMessage;
              if (isImageFileMessage(fm)) {
                const src = fm.thumbnails?.[0]?.plainUrl || fm.plainUrl;
                return (
                  <Ed.FileCard href={fm.url} target="_blank" rel="noreferrer">
                    {src ? (
                      <img
                        alt=""
                        src={src}
                        style={{
                          width: 72,
                          height: 72,
                          objectFit: 'cover',
                          borderRadius: 8,
                        }}
                      />
                    ) : null}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {fm.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: editorialChatTheme.onSurfaceVariant,
                        }}
                      >
                        {(fm.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </Ed.FileCard>
                );
              }
              return (
                <Ed.FileCard href={fm.url} target="_blank" rel="noreferrer">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {fm.name}
                    </div>
                    <div style={{ fontSize: 11 }}>{fm.type}</div>
                  </div>
                </Ed.FileCard>
              );
            })()
          ) : (
            <Ed.MsgText $own={!!own}>{messageBody(m)}</Ed.MsgText>
          )}
          {m.reactions?.length ? (
            <Ed.ReactionRow>
              {m.reactions.map((r) => (
                <Ed.ReactionChip
                  key={r.key}
                  type="button"
                  title={r.key}
                  onClick={() => addReaction(m, r.key)}
                >
                  <span>{r.key}</span>
                  <span>{r.userIds.length}</span>
                </Ed.ReactionChip>
              ))}
            </Ed.ReactionRow>
          ) : null}
          <Ed.MsgActionRow>
            {REACTION_EMOJI.map((emoji) => (
              <Ed.SmallLinkBtn
                key={emoji}
                type="button"
                onClick={() => addReaction(m, emoji)}
              >
                {emoji}
              </Ed.SmallLinkBtn>
            ))}
            <Ed.SmallLinkBtn type="button" onClick={() => pinMessage(m)}>
              {t`Pin`}
            </Ed.SmallLinkBtn>
            {!opts.inThread && replyCount > 0 ? (
              <Ed.ThreadHint
                type="button"
                onClick={() => setThreadRoot(m)}
              >
                {replyCount}{' '}
                {replyCount === 1 ? t`reply` : t`replies`}
              </Ed.ThreadHint>
            ) : null}
            {!opts.inThread && replyCount === 0 ? (
              <Ed.ThreadHint type="button" onClick={() => setThreadRoot(m)}>
                {t`Reply in thread`}
              </Ed.ThreadHint>
            ) : null}
          </Ed.MsgActionRow>
        </Ed.MsgStack>
      </Ed.MsgRow>
    );
  };

  const renderFeed = () => {
    let lastDay: number | null = null;
    return (
      <Ed.MessageScroll>
        {mainMessagesFiltered.map((m) => {
          const day = m.createdAt;
          const showDate =
            lastDay === null || !isSameDay(lastDay, day);
          if (showDate) {
            lastDay = day;
          }
          return (
            <div key={m.messageId}>
              {showDate ? (
                <Ed.DatePill>
                  <Ed.DatePillInner>
                    {format(day, 'EEEE, MMM d')}
                  </Ed.DatePillInner>
                </Ed.DatePill>
              ) : null}
              {renderMessageBlock(m, { inThread: false })}
            </div>
          );
        })}
        {typingMembers.length > 0 ? (
          <Ed.TypingLine>
            <span>
              {typingMembers.map((u) => u.nickname || u.userId).join(', ')}{' '}
              {typingMembers.length === 1 ? t`is typing…` : t`are typing…`}
            </span>
          </Ed.TypingLine>
        ) : null}
      </Ed.MessageScroll>
    );
  };

  const renderMainComposer = () => {
    if (!channelUrl || groupChannel == null) {
      return null;
    }

    return (
      <Ed.ComposerWrap>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={handleFilePick}
        />
        <Ed.ComposerBox>
          <Ed.ComposerToolbar>
            <Ed.ToolbarBtn
              type="button"
              aria-label={t`Bold`}
              onClick={() => {
                const r = insertAround(
                  composerTextareaRef,
                  composer,
                  '**',
                  '**',
                );
                if (r) {
                  setComposer(r.next);
                  requestAnimationFrame(() => {
                    const ta = composerTextareaRef.current;
                    if (ta) {
                      ta.setSelectionRange(r.caret, r.caret);
                    }
                  });
                }
              }}
            >
              B
            </Ed.ToolbarBtn>
            <Ed.ToolbarBtn
              type="button"
              aria-label={t`Italic`}
              onClick={() => {
                const r = insertAround(
                  composerTextareaRef,
                  composer,
                  '_',
                  '_',
                );
                if (r) {
                  setComposer(r.next);
                  requestAnimationFrame(() => {
                    const ta = composerTextareaRef.current;
                    if (ta) {
                      ta.setSelectionRange(r.caret, r.caret);
                    }
                  });
                }
              }}
            >
              I
            </Ed.ToolbarBtn>
            <Ed.ToolbarBtn
              type="button"
              aria-label={t`Code`}
              onClick={() => {
                const r = insertAround(
                  composerTextareaRef,
                  composer,
                  '`',
                  '`',
                );
                if (r) {
                  setComposer(r.next);
                  requestAnimationFrame(() => {
                    const ta = composerTextareaRef.current;
                    if (ta) {
                      ta.setSelectionRange(r.caret, r.caret);
                    }
                  });
                }
              }}
            >
              {'<>'}
            </Ed.ToolbarBtn>
            <Ed.ToolbarBtn
              type="button"
              aria-label={t`Attach file`}
              onClick={() => fileInputRef.current?.click()}
            >
              +
            </Ed.ToolbarBtn>
          </Ed.ComposerToolbar>
          <Ed.ComposerTextarea
            ref={composerTextareaRef}
            placeholder={
              selection
                ? t`Message ${selectionTitle(selection)}`
                : t`Write a message\u2026`
            }
            value={composer}
            onChange={handleComposerChange}
            onKeyDown={onComposerKeyDown}
            onBlur={() => {
              void groupChannelRef.current?.endTyping().catch(() => undefined);
            }}
            disabled={groupChannel == null}
          />
          <Ed.ComposerBottom>
            <Ed.ComposerIconGroup />
            <Ed.SendFab
              type="button"
              disabled={groupChannel == null || !composer.trim()}
              aria-label={t`Send`}
              onClick={sendMainMessage}
            >
              <IconSend size={18} />
            </Ed.SendFab>
          </Ed.ComposerBottom>
        </Ed.ComposerBox>
        {/* CRM @mention popover */}
        {mentionOpen && mentionItems.length > 0 && (
          <div
            role="listbox"
            aria-label="CRM mentions"
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              background: 'var(--twenty-background-primary, #fff)',
              border: '1px solid var(--twenty-border-color-medium, #e4e7ec)',
              borderRadius: 'var(--twenty-border-radius-md, 8px)',
              boxShadow: 'var(--twenty-box-shadow-strong, 0 8px 32px rgba(15,23,42,.18))',
              zIndex: 9999,
              maxHeight: 220,
              overflowY: 'auto',
              fontFamily: 'var(--twenty-font-family, Inter, sans-serif)',
              fontSize: 13,
            }}
          >
            {mentionItems.map((item, idx) => (
              <div
                key={`${item.kind}-${item.label}-${idx}`}
                role="option"
                aria-selected={idx === mentionIndex}
                onClick={() => applyMention(item)}
                style={{
                  padding: item.kind === 'konnecctai' ? '10px 12px' : '8px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background:
                    idx === mentionIndex
                      ? item.kind === 'konnecctai'
                        ? 'linear-gradient(90deg, rgba(79,70,229,0.12) 0%, transparent 100%)'
                        : 'var(--twenty-background-transparent-light)'
                      : 'transparent',
                  borderBottom: item.kind === 'konnecctai' ? '1px solid var(--twenty-border-color-medium, #e4e7ec)' : 'none',
                }}
              >
                <span
                  style={
                    item.kind === 'konnecctai'
                      ? {
                          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                          borderRadius: 4,
                          color: '#fff',
                          flexShrink: 0,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          padding: '2px 6px',
                          textTransform: 'uppercase',
                        }
                      : {
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: 'var(--twenty-font-color-light)',
                          flexShrink: 0,
                        }
                  }
                >
                  {item.kind === 'konnecctai' ? '✦ AI' : item.kind === 'agent' ? 'AI' : 'CRM'}
                </span>
                <span
                  style={{
                    color: item.kind === 'konnecctai' ? 'var(--twenty-color-blue)' : 'var(--twenty-font-color-primary)',
                    fontWeight: item.kind === 'konnecctai' ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </span>
                {item.kind === 'konnecctai' ? (
                  <span
                    style={{
                      color: 'var(--twenty-font-color-tertiary)',
                      fontSize: 11,
                      marginLeft: 'auto',
                    }}
                  >
                    Ask anything
                  </span>
                ) : null}
              </div>
            ))}

          </div>
        )}
      </Ed.ComposerWrap>
    );
  };


  if (layoutLoading && !layout) {
    return (
      <Ed.StyledShell>
        <Ed.StyledCenterBlock>
          <Ed.StyledCenterTitle>{t`Loading workspace…`}</Ed.StyledCenterTitle>
        </Ed.StyledCenterBlock>
      </Ed.StyledShell>
    );
  }

  if (layoutError) {
    return (
      <Ed.StyledShell>
        <Ed.StyledCenterError>
          <Ed.StyledCenterTitle>{t`Could not load chat layout`}</Ed.StyledCenterTitle>
          <span>{layoutError}</span>
        </Ed.StyledCenterError>
      </Ed.StyledShell>
    );
  }

  const headerSubtitle =
    channelUrl && selection
      ? selection.kind === 'channel'
        ? selection.channel.visibility === 'public'
          ? t`Everyone in this workspace`
          : t`Invited members`
        : t`Direct message`
      : selection
        ? t`Preparing…`
        : t`Select a conversation`;

  const groupCallRemoteCount =
    activeGroupRoom?.remoteParticipants?.length ?? 0;

  return (
    <Ed.StyledShell>
      {/* CRM topbar is provided by the parent layout — no duplicate Editorial nav here */}
      <Ed.StyledBodyRow>

        <EditorialWorkspaceRail
          workspaceTitle={workspaceTitle}
          planLabel={planLabel}
          isWorkspaceAdmin={isWorkspaceAdmin}
          onOpenCreateChannel={() => setCreateChannelOpen(true)}
          onOpenNewDm={() => setDmModalOpen(true)}
          onOpenAI={() => aiPanel.toggle()}
          isAIOpen={aiPanel.isOpen}
          search={search}
          onSearchChange={setSearch}
          filteredCategories={filteredCategories}
          filteredDms={filteredDms}
          selection={selection}
          onSelectChannel={(channel) =>
            setSelection({ kind: 'channel', channel })
          }
          onSelectDm={(dm) => setSelection({ kind: 'dm', dm })}
          dmRowMeta={dmRowMeta}
          viewerAvatarUrl={viewerMember?.avatarUrl ?? null}
          viewerFooterTitle={
            viewerMember ? memberDisplayName(viewerMember) : t`Member`
          }
          viewerAvatarPlaceholder={
            viewerMember
              ? memberDisplayName(viewerMember)
              : layout?.viewer.userWorkspaceId ?? '?'
          }
          viewerAvatarPlaceholderSeed={viewerUserWorkspaceId ?? 'me'}
        />


        {activeGroupRoom ? (
          <>
            <Ed.StyledMainColumn style={{ position: 'relative' }}>
              <Ed.StyledLiveBadge>
                <Ed.StyledDot $tone="live" />
                {t`Live call`} · {workspaceTitle}
              </Ed.StyledLiveBadge>
              <Ed.StyledCallStage>
                <Ed.StyledCallStageVideo
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                />
                <Ed.StyledPipVideo
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                />
              </Ed.StyledCallStage>
              <Ed.StyledGroupCallGrid>
                {Array.from({
                  length: Math.max(1, groupCallRemoteCount + 1),
                }).map((_, i) => (
                  <Ed.StyledParticipantTile key={i} $highlight={i === 0}>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        color: editorialChatTheme.onSurfaceVariant,
                      }}
                    >
                      {i === 0 ? t`You / remote` : `${t`Participant`} ${i}`}
                    </div>
                  </Ed.StyledParticipantTile>
                ))}
              </Ed.StyledGroupCallGrid>
              <Ed.StyledGlassControlBar>
                <Ed.StyledRoundCtrl
                  type="button"
                  aria-label={t`Mute`}
                  onClick={() => {
                    const room = activeGroupRoom;
                    const local = room.localParticipant;
                    if (local.isAudioEnabled) {
                      local.muteMicrophone();
                    } else {
                      local.unmuteMicrophone();
                    }
                  }}
                >
                  <IconMicrophone size={20} />
                </Ed.StyledRoundCtrl>
                <Ed.StyledLeaveCallBtn type="button" onClick={handleLeaveGroupRoom}>
                  <IconPhoneOff size={18} /> {t`Leave`}
                </Ed.StyledLeaveCallBtn>
              </Ed.StyledGlassControlBar>
            </Ed.StyledMainColumn>
            <Ed.StyledNotesPanel style={{ width: 320 }}>
              <Ed.StyledNotesHeader>
                <Ed.StyledNotesTitle>{t`Group chat`}</Ed.StyledNotesTitle>
              </Ed.StyledNotesHeader>
              {renderFeed()}
              <Ed.StyledComposerWrap
                style={{
                  borderTop: `1px solid ${editorialChatTheme.outlineVariantGhost}`,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  onChange={handleFilePick}
                />
                <Ed.StyledComposerBox>
                  <Ed.StyledComposerTextarea
                    ref={composerTextareaRef}
                    placeholder={t`Send a message…`}
                    value={composer}
                    onChange={(e) => {
                      setComposer(e.target.value);
                      fireTyping();
                    }}
                    onKeyDown={onComposerKeyDown}
                    disabled={groupChannel == null}
                  />
                  <Ed.StyledComposerBottom>
                    <Ed.StyledSendFab
                      type="button"
                      disabled={groupChannel == null || !composer.trim()}
                      onClick={sendMainMessage}
                    >
                      <IconSend size={18} />
                    </Ed.StyledSendFab>
                  </Ed.StyledComposerBottom>
                </Ed.StyledComposerBox>
              </Ed.StyledComposerWrap>
            </Ed.StyledNotesPanel>
          </>
        ) : directCallActive && selection?.kind === 'dm' ? (
          <>
            <Ed.StyledMainColumn style={{ position: 'relative' }}>
              <Ed.StyledCallStage>
                <Ed.StyledCallStageVideo
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                />
                <Ed.StyledPipVideo
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                />
              </Ed.StyledCallStage>
              <Ed.StyledGlassControlBar>
                <Ed.StyledRoundCtrl
                  type="button"
                  aria-label={t`Mute`}
                  onClick={() => toggleMute()}
                >
                  {activeCall?.isLocalAudioEnabled ? (
                    <IconMicrophone size={20} />
                  ) : (
                    <IconMicrophoneOff size={20} />
                  )}
                </Ed.StyledRoundCtrl>
                {activeCall?.isVideoCall ? (
                  <Ed.StyledRoundCtrl
                    type="button"
                    aria-label={t`Camera`}
                    onClick={() => toggleVideo()}
                  >
                    {activeCall.isLocalVideoEnabled ? (
                      <IconVideo size={20} />
                    ) : (
                      <IconVideoOff size={20} />
                    )}
                  </Ed.StyledRoundCtrl>
                ) : null}
                {activeCall?.isVideoCall ? (
                  <Ed.StyledRoundCtrl
                    type="button"
                    aria-label={t`Screen share`}
                    onClick={() => toggleScreenShare()}
                  >
                    <IconScreenShare size={20} />
                  </Ed.StyledRoundCtrl>
                ) : null}
                <Ed.StyledLeaveCallBtn type="button" onClick={leaveDirectCall}>
                  <IconPhoneOff size={18} /> {t`Leave call`}
                </Ed.StyledLeaveCallBtn>
              </Ed.StyledGlassControlBar>
            </Ed.StyledMainColumn>
            <Ed.StyledNotesPanel>
              <Ed.StyledNotesHeader>
                <Ed.StyledNotesTitle>{t`Collaborative notes`}</Ed.StyledNotesTitle>
              </Ed.StyledNotesHeader>
              <Ed.StyledNotesScroll>
                {noteMessages.map((n) => (
                  <Ed.StyledNoteCard key={n.messageId}>{n.message}</Ed.StyledNoteCard>
                ))}
              </Ed.StyledNotesScroll>
              <Ed.StyledNotesInputRow>
                <Ed.StyledNotesField
                  placeholder={t`Add a quick note…`}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendNote();
                    }
                  }}
                />
                <Button
                  title={t`Save note`}
                  variant="secondary"
                  onClick={sendNote}
                  disabled={!noteDraft.trim() || groupChannel == null}
                />
              </Ed.StyledNotesInputRow>
            </Ed.StyledNotesPanel>
          </>
        ) : (
          <>
            <Ed.StyledMainColumn style={{ position: 'relative' }}>
              <Ed.StyledTopBar>
                <Ed.StyledTopBarLeft>
                  {selection?.kind === 'channel' ? (
                    <span
                      style={{
                        color: editorialChatTheme.onSurfaceVariant,
                        fontSize: 18,
                      }}
                    >
                      #
                    </span>
                  ) : null}
                  <div style={{ minWidth: 0 }}>
                    <Ed.StyledTopBarTitle>
                      {selection ? selectionTitle(selection) : t`Chat`}
                    </Ed.StyledTopBarTitle>
                    <Ed.StyledTopBarMeta>{headerSubtitle}</Ed.StyledTopBarMeta>
                  </div>
                </Ed.StyledTopBarLeft>
                <Ed.StyledTopBarActions>
                  <Ed.StyledSearchField
                    placeholder={t`Search in conversation…`}
                    value={mainSearch}
                    onChange={(e) => setMainSearch(e.target.value)}
                  />
                  {selection?.kind === 'channel' ? (
                    <>
                      <Ed.StyledIconButtonPrimary
                        type="button"
                        disabled={!callsReady}
                        onClick={() => void handleCreateGroupRoom()}
                      >
                        <IconVideo size={16} /> {t`Join call`}
                      </Ed.StyledIconButtonPrimary>
                    </>
                  ) : null}
                  {selection?.kind === 'dm' &&
                  selection.dm.kind === 'direct' &&
                  peerScopedIdForDm ? (
                    <>
                      <Ed.StyledIconButtonGhost
                        type="button"
                        disabled={!callsReady}
                        onClick={() => startDmCall(false)}
                      >
                        <IconPhone size={16} /> {t`Call`}
                      </Ed.StyledIconButtonGhost>
                      <Ed.StyledIconButtonPrimary
                        type="button"
                        disabled={!callsReady}
                        onClick={() => startDmCall(true)}
                      >
                        <IconVideo size={16} /> {t`Video`}
                      </Ed.StyledIconButtonPrimary>
                    </>
                  ) : null}
                  {/* KonnecctAI toggle button */}
                  <Ed.StyledAIToggleButton
                    type="button"
                    $active={aiPanel.isOpen}
                    onClick={() => aiPanel.toggle()}
                    aria-label={t`KonnecctAI`}
                    title={aiPanel.isOpen ? t`Hide KonnecctAI` : t`Ask KonnecctAI`}
                  >
                    <IconSparkles size={15} />
                    {t`AI`}
                  </Ed.StyledAIToggleButton>
                </Ed.StyledTopBarActions>
              </Ed.StyledTopBar>

              {connectError ? (
                <Ed.StyledCenterError>
                  <Ed.StyledCenterTitle>{t`Could not connect to chat`}</Ed.StyledCenterTitle>
                  <span>{connectError}</span>
                  <Button
                    accent="blue"
                    title={t`Try again`}
                    variant="primary"
                    onClick={() => {
                      setConnectError(null);
                      setSessionAttempt((n) => n + 1);
                    }}
                  />
                </Ed.StyledCenterError>
              ) : !sb ? (
                <Ed.StyledCenterBlock>
                  <Ed.StyledCenterTitle>{t`Connecting…`}</Ed.StyledCenterTitle>
                  <span style={{ color: editorialChatTheme.onSurfaceVariant }}>
                    {t`Signing you in to workspace chat`}
                  </span>
                </Ed.StyledCenterBlock>
              ) : !channelUrl ? (
                <Ed.StyledCenterBlock>
                  <Ed.StyledCenterTitle>
                    {selection ? t`Almost there` : t`Select a conversation`}
                  </Ed.StyledCenterTitle>
                  <span style={{ color: editorialChatTheme.onSurfaceVariant }}>
                    {selection
                      ? t`Linking this thread to chat.`
                      : t`Choose a channel or DM in the list.`}
                  </span>
                </Ed.StyledCenterBlock>
              ) : (
                renderFeed()
              )}
              {!connectError && sb && channelUrl ? renderMainComposer() : null}

              {threadRoot ? (
                <Ed.StyledThreadDrawer role="dialog" aria-modal="true">
                  <Ed.StyledThreadDrawerHeader>
                    <Ed.StyledDetailsTitle>{t`Thread`}</Ed.StyledDetailsTitle>
                    <button
                      type="button"
                      aria-label={t`Close thread`}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: editorialChatTheme.onSurfaceVariant,
                        cursor: 'pointer',
                      }}
                      onClick={() => setThreadRoot(null)}
                    >
                      <IconX size={18} />
                    </button>
                  </Ed.StyledThreadDrawerHeader>
                  <Ed.StyledThreadDrawerScroll>
                    {renderMessageBlock(threadRoot, { inThread: true })}
                    {threadReplies.map((tm) =>
                      renderMessageBlock(tm, { inThread: true }),
                    )}
                  </Ed.StyledThreadDrawerScroll>
                  <Ed.StyledComposerWrap>
                    <Ed.StyledComposerBox>
                      <Ed.StyledComposerTextarea
                        ref={threadTextareaRef}
                        placeholder={t`Reply in thread…`}
                        value={threadComposer}
                        onChange={(e) => setThreadComposer(e.target.value)}
                        onKeyDown={onThreadKeyDown}
                      />
                      <Ed.StyledComposerBottom>
                        <Ed.StyledSendFab
                          type="button"
                          disabled={!threadComposer.trim()}
                          onClick={sendThreadMessage}
                        >
                          <IconSend size={18} />
                        </Ed.StyledSendFab>
                      </Ed.StyledComposerBottom>
                    </Ed.StyledComposerBox>
                  </Ed.StyledComposerWrap>
                </Ed.StyledThreadDrawer>
              ) : null}
            </Ed.StyledMainColumn>

            <EditorialDetailsPanel
              selection={selection}
              groupChannel={groupChannel}
              channelTopic={channelTopic}
              pinnedMessages={pinnedMessages}
              mediaThumbs={mediaThumbs}
              onLeaveChannel={leaveChannel}
              dmPeerMember={dmPeerMember}
              memberDisplayName={memberDisplayName}
            />
            <KonnecctAIPanel />
          </>
        )}
      </Ed.StyledBodyRow>

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
        <Ed.StyledModalBackdrop role="dialog" aria-modal="true">
          <Ed.StyledModalPanel>
            <Ed.StyledCenterTitle style={{ display: 'block', marginBottom: 8 }}>
              {t`Incoming call`}
            </Ed.StyledCenterTitle>
            <p
              style={{
                color: editorialChatTheme.onSurfaceVariant,
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              {(() => {
                const fromMember = memberByScopedId.get(
                  incomingCall.caller.userId,
                );
                return (
                  (fromMember ? memberDisplayName(fromMember) : '') ||
                  incomingCall.caller.nickname?.trim() ||
                  incomingCall.caller.userId
                );
              })()}
            </p>
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
          </Ed.StyledModalPanel>
        </Ed.StyledModalBackdrop>
      ) : null}
    </Ed.StyledShell>
  );
};

/**
 * SendbirdCommunicationHub — entrypoint with all required context providers.
 * The inner hub uses KonnecctAIPanelProvider for the AI slide-in panel.
 */
export const SendbirdCommunicationHub = () => (
  <KonnecctAIPanelProvider>
    <SendbirdCommunicationHubInner />
  </KonnecctAIPanelProvider>
);

export default SendbirdCommunicationHub;
