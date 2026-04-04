import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import AC from 'agora-chat';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';

import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import {
  agoraConnectionStateAtom,
  agoraConnectionErrorAtom,
  agoraConversationsAtom,
  currentMessagesAtom,
  lastInboundChatNotifyAtom,
  type ChatMessage,
} from '../states/agoraSessionState';

const AGORA_APP_KEY = '7110032205#200010602';

let _agoraClient: AC.Connection | null = null;

function parseMessageExt(raw: unknown): Record<string, string> {
  if (raw == null) {
    return {};
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, string>;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

/** Agora uses group id as `to` for group traffic; DMs key by the peer id. */
function resolveConversationId(
  msg: {
    from?: string;
    to?: string;
    chatType?: string;
    type?: string;
    group?: string;
  },
  selfUser: string | undefined,
): string {
  const chatTypeRaw = String(msg.chatType ?? msg.type ?? '').toLowerCase();
  const isGroup =
    chatTypeRaw === 'groupchat' ||
    chatTypeRaw === 'group' ||
    Boolean(msg.group);

  if (isGroup) {
    return String(msg.to ?? '');
  }

  const from = String(msg.from ?? '');
  const to = String(msg.to ?? '');

  if (selfUser && from === selfUser) {
    return to;
  }

  return from;
}

export const useAgoraChat = () => {
  const setConnectionState = useSetAtom(agoraConnectionStateAtom);
  const setConnectionError = useSetAtom(agoraConnectionErrorAtom);
  const setConversations = useSetAtom(agoraConversationsAtom);
  const setMessages = useSetAtom(currentMessagesAtom);
  const setLastInboundNotify = useSetAtom(lastInboundChatNotifyAtom);
  const tokenPair = useAtomValue(tokenPairState.atom);
  const crmToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const workspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const currentUser = useAtomStateValue(currentUserState);

  const senderProfile = useMemo(() => {
    const nameFromMember = workspaceMember
      ? [workspaceMember.name.firstName, workspaceMember.name.lastName]
          .filter(Boolean)
          .join(' ')
          .trim()
      : '';
    const nameFromUser = currentUser
      ? [currentUser.firstName, currentUser.lastName]
          .filter(Boolean)
          .join(' ')
          .trim()
      : '';
    const displayName =
      nameFromMember ||
      nameFromUser ||
      currentUser?.email?.split('@')[0] ||
      'Member';

    return {
      displayName,
      avatarUrl: workspaceMember?.avatarUrl ?? '',
    };
  }, [workspaceMember, currentUser]);

  const senderProfileRef = useRef(senderProfile);
  senderProfileRef.current = senderProfile;

  const {
    getToken: getClerkToken,
    orgId: clerkOrgId,
    isLoaded: isClerkLoaded,
    isSignedIn: isClerkSignedIn,
  } = useClerkAuth();
  const initRef = useRef(false);

  const handleIncomingMessage = useCallback(
    (msg: Record<string, unknown>, type: string) => {
      const self = _agoraClient?.user;
      const ext = parseMessageExt(msg.ext);
      const actualConvoId = resolveConversationId(
        msg as {
          from?: string;
          to?: string;
          chatType?: string;
          type?: string;
          group?: string;
        },
        self,
      );

      if (!actualConvoId) {
        return;
      }

      const fromId = String(msg.from ?? '');
      const direction: ChatMessage['direction'] =
        self && fromId === self ? 'out' : 'in';

      const newChatMessage: ChatMessage = {
        id: String(msg.id ?? msg.mid ?? `${Date.now()}-${Math.random()}`),
        conversationId: actualConvoId,
        senderId: fromId,
        senderName: ext.senderName || fromId,
        senderAvatarUrl: ext.senderAvatarUrl || undefined,
        type: type as ChatMessage['type'],
        text: typeof msg.msg === 'string' ? msg.msg : undefined,
        url: typeof msg.url === 'string' ? msg.url : undefined,
        filename: typeof msg.filename === 'string' ? msg.filename : undefined,
        createdAt: (msg.time as number) || Date.now(),
        status: 'delivered',
        direction,
      };

      setMessages((prev) => ({
        ...prev,
        [actualConvoId]: [...(prev[actualConvoId] || []), newChatMessage],
      }));

      if (direction === 'in') {
        const preview =
          newChatMessage.type === 'txt'
            ? (newChatMessage.text ?? '').slice(0, 200)
            : `[${newChatMessage.type}]`;

        setLastInboundNotify({
          conversationId: actualConvoId,
          preview: preview || 'New message',
          senderName: newChatMessage.senderName ?? fromId,
          messageId: newChatMessage.id,
          at: Date.now(),
        });
      }

      setConversations((prev) => {
        const existing = prev.find((c) => c.id === actualConvoId);
        if (existing) {
          return prev.map((c) =>
            c.id === actualConvoId
              ? {
                  ...c,
                  lastMessage: newChatMessage,
                  unreadCount:
                    direction === 'in'
                      ? c.unreadCount + 1
                      : c.unreadCount,
                }
              : c,
          );
        }
        return [
          ...prev,
          {
            id: actualConvoId,
            type:
              String(msg.chatType ?? '').toLowerCase() === 'groupchat'
                ? 'groupChat'
                : 'singleChat',
            name: newChatMessage.senderName || actualConvoId,
            unreadCount: direction === 'in' ? 1 : 0,
            lastMessage: newChatMessage,
          },
        ];
      });
    },
    [setMessages, setConversations, setLastInboundNotify],
  );

  useEffect(() => {
    if (!initRef.current) {
      if (!_agoraClient) {
        _agoraClient = new AC.connection({
          appKey: AGORA_APP_KEY,
        });
      }
      initRef.current = true;
    }

    if (_agoraClient) {
      _agoraClient.addEventHandler('connection', {
        onOpened: () => {
          setConnectionState('connected');
        },
        onConnected: () => {
          setConnectionState('connected');
        },
        onClosed: () => {
          setConnectionState('disconnected');
        },
        onDisconnected: () => {
          setConnectionState('disconnected');
        },
        onError: (err) => {
          setConnectionError(err.message || 'Unknown Agora error');
          setConnectionState('error');
        },
      });

      _agoraClient.addEventHandler('message_events', {
        onTextMessage: (msg) => handleIncomingMessage(msg as any, 'txt'),
        onImageMessage: (msg) => handleIncomingMessage(msg as any, 'img'),
        onAudioMessage: (msg) => handleIncomingMessage(msg as any, 'audio'),
        onVideoMessage: (msg) => handleIncomingMessage(msg as any, 'video'),
        onFileMessage: (msg) => handleIncomingMessage(msg as any, 'file'),
        onCustomMessage: (msg) => handleIncomingMessage(msg as any, 'custom'),
      });
    }

    return () => {
      if (_agoraClient) {
        _agoraClient.removeEventHandler('connection');
        _agoraClient.removeEventHandler('message_events');
      }
    };
  }, [handleIncomingMessage, setConnectionError, setConnectionState]);

  const connectToAgora = useCallback(async () => {
    const resolveAuthToken = async () => {
      if (crmToken) {
        return crmToken;
      }

      return await getClerkToken();
    };

    try {
      const authToken = await resolveAuthToken();

      if (!authToken) {
        setConnectionError('Missing CRM/Clerk auth token');
        setConnectionState('error');
        return;
      }

      if (!crmToken && !isClerkLoaded) {
        setConnectionState('waiting_session');
        setConnectionError(null);
        return;
      }

      if (
        isClerkLoaded &&
        isClerkSignedIn &&
        !crmToken &&
        !clerkOrgId
      ) {
        setConnectionState('waiting_session');
        setConnectionError(null);
        return;
      }

      setConnectionState('connecting');
      const response = await fetch('/agora/token', {
        headers: {
          Authorization: `Bearer ${authToken}`,
          ...(clerkOrgId ? { 'X-Clerk-Org-Id': clerkOrgId } : {}),
        },
      });

      if (!response.ok) {
        const raw = await response.text();
        let detail = `HTTP ${response.status}`;

        try {
          const parsed = JSON.parse(raw) as { message?: string | string[] };
          const msg = parsed.message;

          detail = Array.isArray(msg) ? msg.join(', ') : msg ?? detail;
        } catch {
          if (raw && !raw.trimStart().startsWith('<')) {
            detail = raw.slice(0, 200);
          }
        }

        throw new Error(detail || 'Failed to fetch Agora token');
      }

      const { agoraToken, userIdentifier } = await response.json();

      if (!_agoraClient) {
        throw new Error('Agora client not initialized');
      }

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const safeResolve = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };
        const safeReject = (err: Error) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        };

        void _agoraClient
          ?.open({
            user: userIdentifier,
            accessToken: agoraToken,
            success: () => {
              safeResolve();
            },
            error: (res: { message?: string; type?: number } | string) => {
              const detail =
                typeof res === 'string'
                  ? res
                  : res?.message ?? JSON.stringify(res);
              safeReject(new Error(detail || 'Agora login failed'));
            },
          })
          .then(() => {
            safeResolve();
          })
          .catch((err: unknown) => {
            safeReject(
              err instanceof Error ? err : new Error(String(err)),
            );
          });
      });

      setConnectionState('connected');
    } catch (error: unknown) {
      setConnectionError(
        error instanceof Error ? error.message : String(error),
      );
      setConnectionState('error');
    }
  }, [
    clerkOrgId,
    crmToken,
    getClerkToken,
    isClerkLoaded,
    isClerkSignedIn,
    setConnectionState,
    setConnectionError,
  ]);

  const disconnectFromAgora = useCallback(() => {
    _agoraClient?.close();
  }, []);

  const buildSenderExt = useCallback(() => {
    const { displayName, avatarUrl } = senderProfileRef.current;

    return {
      senderName: displayName,
      senderAvatarUrl: avatarUrl || '',
    };
  }, []);

  const sendMessage = useCallback(
    (
      targetId: string,
      text: string,
      chatType: 'singleChat' | 'groupChat' = 'singleChat',
    ) => {
      if (!_agoraClient) {
        return;
      }

      const ext = buildSenderExt();
      const msg = AC.message.create({
        to: targetId,
        type: 'txt',
        msg: text,
        chatType,
        ext,
      });

      handleIncomingMessage(
        {
          ...msg,
          time: Date.now(),
          from: _agoraClient.user,
          ext,
        },
        'txt',
      );
      void _agoraClient.send(msg).catch((err) => console.error(err));
    },
    [buildSenderExt, handleIncomingMessage],
  );

  const sendAttachment = useCallback(
    (
      targetId: string,
      file: File,
      type: 'img' | 'file' | 'audio' | 'video',
      chatType: 'singleChat' | 'groupChat' = 'singleChat',
      extraParams?: Record<string, unknown>,
    ) => {
      if (!_agoraClient) {
        return;
      }

      const ext = buildSenderExt();
      const msg = AC.message.create({
        type,
        to: targetId,
        chatType,
        ext,
        file: {
          data: file,
          filename: file.name,
          url: '',
        },
        ...extraParams,
      });

      const localUrl = URL.createObjectURL(file);
      handleIncomingMessage(
        {
          ...msg,
          url: localUrl,
          time: Date.now(),
          from: _agoraClient.user,
          ext,
        },
        type,
      );

      void _agoraClient.send(msg).catch((err) => console.error(err));
    },
    [buildSenderExt, handleIncomingMessage],
  );

  return {
    connectToAgora,
    disconnectFromAgora,
    sendMessage,
    sendAttachment,
    client: _agoraClient,
  };
};
