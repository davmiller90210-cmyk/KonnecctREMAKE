import { useEffect, useCallback, useRef } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import AC from 'agora-chat';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';

import {
  agoraConnectionStateAtom,
  agoraConnectionErrorAtom,
  agoraConversationsAtom,
  currentMessagesAtom,
  type ChatMessage,
} from '../states/agoraSessionState';
import { agoraPayloadToChatMessage } from '../utils/agora-message-mapper';
import { notifyIncomingChatIfBackground } from '../utils/chat-desktop-notify';
import { tokenPairState } from '@/auth/states/tokenPairState';

const AGORA_APP_KEY = '7110032205#200010602';

let _agoraClient: AC.Connection | null = null;

export const useAgoraChat = () => {
  const setConnectionState = useSetAtom(agoraConnectionStateAtom);
  const setConnectionError = useSetAtom(agoraConnectionErrorAtom);
  const setConversations = useSetAtom(agoraConversationsAtom);
  const setMessages = useSetAtom(currentMessagesAtom);
  const tokenPair = useAtomValue(tokenPairState.atom);
  const crmToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const {
    getToken: getClerkToken,
    orgId: clerkOrgId,
    isLoaded: isClerkLoaded,
    isSignedIn: isClerkSignedIn,
  } = useClerkAuth();
  const initRef = useRef(false);

  const handleIncomingMessage = useCallback((msg: Record<string, unknown>, typeHint: string) => {
    const merged = { ...msg, type: (msg.type as string) || typeHint };
    const currentUser = _agoraClient?.user;
    const newChatMessage = agoraPayloadToChatMessage(merged, currentUser);

    if (!newChatMessage) {
      return;
    }

    const actualConvoId = newChatMessage.conversationId;

    if (newChatMessage.direction === 'in') {
      notifyIncomingChatIfBackground({
        title: 'Konnecct chat',
        body:
          newChatMessage.type === 'txt'
            ? (newChatMessage.text ?? '').slice(0, 160) || 'New message'
            : 'New message',
      });
    }

    setMessages((prev) => {
      const list = prev[actualConvoId] ?? [];

      if (list.some((m) => m.id === newChatMessage.id)) {
        return prev;
      }

      return {
        ...prev,
        [actualConvoId]: [...list, newChatMessage],
      };
    });

    setConversations((prev) => {
      const existing = prev.find((c) => c.id === actualConvoId);

      if (existing) {
        return prev.map((c) =>
          c.id === actualConvoId
            ? {
                ...c,
                lastMessage: newChatMessage,
                unreadCount:
                  newChatMessage.direction === 'in'
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
            merged.chatType === 'groupChat' || merged.chatType === 'groupchat'
              ? 'groupChat'
              : 'singleChat',
          name:
            (merged.ext as { senderName?: string } | undefined)?.senderName ||
            actualConvoId,
          unreadCount: newChatMessage.direction === 'in' ? 1 : 0,
          lastMessage: newChatMessage,
        },
      ];
    });
  }, [setMessages, setConversations]);

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
          console.error('[KONNECCT-AGORA] Connection error:', err);
          setConnectionError(err.message || 'Unknown Agora error');
          setConnectionState('error');
        },
      });

      _agoraClient.addEventHandler('message_events', {
        onTextMessage: (msg) => handleIncomingMessage(msg as unknown as Record<string, unknown>, 'txt'),
        onImageMessage: (msg) => handleIncomingMessage(msg as unknown as Record<string, unknown>, 'img'),
        onAudioMessage: (msg) => handleIncomingMessage(msg as unknown as Record<string, unknown>, 'audio'),
        onVideoMessage: (msg) => handleIncomingMessage(msg as unknown as Record<string, unknown>, 'video'),
        onFileMessage: (msg) => handleIncomingMessage(msg as unknown as Record<string, unknown>, 'file'),
        onCustomMessage: (msg) => handleIncomingMessage(msg as unknown as Record<string, unknown>, 'custom'),
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
        setConnectionState('idle');
        setConnectionError(null);
        return;
      }

      if (isClerkLoaded && isClerkSignedIn && !crmToken && !clerkOrgId) {
        setConnectionState('idle');
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

      _agoraClient?.open({
        user: userIdentifier,
        accessToken: agoraToken,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      setConnectionError(message);
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

  const syncConversationHistory = useCallback(
    async (targetId: string, chatType: 'singleChat' | 'groupChat') => {
      if (!_agoraClient) {
        return;
      }

      try {
        const res = await _agoraClient.getHistoryMessages({
          targetId,
          chatType,
          pageSize: 50,
          cursor: -1,
          searchDirection: 'up',
        });

        const currentUser = _agoraClient.user;
        const mapped = (res.messages ?? [])
          .map((m) =>
            agoraPayloadToChatMessage(m as unknown as Record<string, unknown>, currentUser),
          )
          .filter((m): m is ChatMessage => m !== null);

        mapped.sort((a, b) => a.createdAt - b.createdAt);

        setMessages((prev) => ({
          ...prev,
          [targetId]: mapped,
        }));
      } catch (error) {
        console.warn('[KONNECCT-AGORA] getHistoryMessages failed', error);
      }
    },
    [setMessages],
  );

  const sendMessage = useCallback(
    (targetId: string, text: string, chatType: 'singleChat' | 'groupChat' = 'singleChat') => {
      if (!_agoraClient) {
        return;
      }

      const msg = AC.message.create({
        to: targetId,
        type: 'txt',
        msg: text,
        chatType,
      });

      handleIncomingMessage(
        {
          ...msg,
          id: `local-${Date.now()}`,
          time: Date.now(),
          from: _agoraClient.user,
          to: targetId,
          chatType,
          type: 'txt',
          msg: text,
        },
        'txt',
      );
      _agoraClient.send(msg).catch((err) => console.error(err));
    },
    [handleIncomingMessage],
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

      const msg = AC.message.create({
        type,
        to: targetId,
        chatType,
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
          to: targetId,
          chatType,
          type,
          filename: file.name,
        },
        type,
      );

      _agoraClient.send(msg).catch((err) => console.error(err));
    },
    [handleIncomingMessage],
  );

  return {
    connectToAgora,
    disconnectFromAgora,
    sendMessage,
    sendAttachment,
    syncConversationHistory,
    client: _agoraClient,
  };
};
