import { useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { tokenPairState } from '@/auth/states/tokenPairState';
import {
  type NativeChatMessage,
  type NativeChatPinnedMessage,
  type NativeTypingMember,
} from '@/chat/types/native-chat-message.type';
import { type NativeChatReadState } from '@/chat/types/native-chat-read-state.type';
import {
  parseSseBlock,
  parseSseEventBlocks,
} from '@/chat/utils/parseChatSse';

export const NATIVE_CHAT_OPTIMISTIC_ID_PREFIX = '__optimistic:';

type UseNativeChatChannelOptions = {
  channelId: string | null;
  dmThreadId: string | null;
  /** Native conversation id for optimistic rows (layout `nativeConversationId`). */
  nativeConversationId?: string | null;
  viewerUserWorkspaceId?: string | null;
  /** Viewer CRM profile for optimistic outgoing messages. */
  viewerProfile?: {
    userWorkspaceId: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  } | null;
  /** Refresh layout (unread badges) when peers mark read */
  onConversationRealtime?: () => void;
};

type UseNativeChatChannelResult = {
  channel: { id: string } | null;
  messages: NativeChatMessage[];
  pinnedMessages: NativeChatPinnedMessage[];
  readState: NativeChatReadState | null;
  isLoading: boolean;
  /** Failed to load message history (full fetch). */
  loadError: string | null;
  typingMembers: NativeTypingMember[];
  sendMessage: (text: string) => Promise<void>;
  markAsRead: (upToMessageId?: string | null) => void;
  sendTypingStart: (_nickname?: string) => void;
  sendTypingEnd: () => void;
  reload: () => void;
  reloadPins: () => void;
  toggleReaction: (
    messageId: string,
    emoji: string,
    remove: boolean,
  ) => Promise<void>;
  pinMessage: (messageId: string) => Promise<void>;
  unpinMessage: (messageId: string) => Promise<void>;
  /** Message id to play a brief “just sent” highlight on the bubble. */
  highlightMessageId: string | null;
};

const TYPING_TTL_MS = 4500;
const TYPING_POST_MIN_INTERVAL_MS = 2000;

export const nativeMessageBody = (message: NativeChatMessage): string => {
  return message.body;
};

export const getNativeMessageSenderId = (
  message: NativeChatMessage,
): string | undefined => {
  return message.sender?.userWorkspaceId;
};

type TypingEntry = {
  nickname: string;
  expiresAt: number;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const parseFetchErrorMessage = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  try {
    const body = (await response.clone().json()) as {
      message?: string | string[];
    };
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message.trim();
    }
    if (Array.isArray(body.message) && body.message.length > 0) {
      return body.message.map(String).join(', ');
    }
  } catch {
    // ignore
  }
  return fallback;
};

export const useNativeChatChannel = ({
  channelId,
  dmThreadId,
  nativeConversationId,
  viewerUserWorkspaceId,
  viewerProfile,
  onConversationRealtime,
}: UseNativeChatChannelOptions): UseNativeChatChannelResult => {
  const tokenPair = useAtomValue(tokenPairState.atom);
  const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  const [channel, setChannel] = useState<{ id: string } | null>(null);
  const [messages, setMessages] = useState<NativeChatMessage[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<NativeChatPinnedMessage[]>(
    [],
  );
  const [readState, setReadState] = useState<NativeChatReadState | null>(null);
  const [typingMembers, setTypingMembers] = useState<NativeTypingMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(
    null,
  );
  const highlightTimeoutRef = useRef<number | null>(null);
  const lastMessageAtRef = useRef<string | null>(null);
  const lastSseActivityRef = useRef(0);
  const typingByUserRef = useRef<Map<string, TypingEntry>>(new Map());
  const typingTickRef = useRef<number | null>(null);
  const lastTypingPostRef = useRef(0);
  const streamAttemptRef = useRef(0);
  const conversationKey = useMemo(
    () => `${channelId ?? ''}:${dmThreadId ?? ''}`,
    [channelId, dmThreadId],
  );

  const flushTypingState = useCallback(() => {
    const now = Date.now();
    const map = typingByUserRef.current;
    let changed = false;

    for (const [userId, entry] of map) {
      if (entry.expiresAt <= now) {
        map.delete(userId);
        changed = true;
      }
    }

    if (!changed) {
      return;
    }

    setTypingMembers(
      Array.from(map.entries()).map(([userId, entry]) => ({
        userId,
        nickname: entry.nickname,
      })),
    );
  }, []);

  const upsertTyping = useCallback(
    (userWorkspaceId: string, nickname: string, active: boolean) => {
      if (
        viewerUserWorkspaceId &&
        userWorkspaceId === viewerUserWorkspaceId
      ) {
        return;
      }

      const map = typingByUserRef.current;

      if (!active) {
        map.delete(userWorkspaceId);
      } else {
        map.set(userWorkspaceId, {
          nickname: nickname || 'Member',
          expiresAt: Date.now() + TYPING_TTL_MS,
        });
      }

      setTypingMembers(
        Array.from(map.entries()).map(([userId, entry]) => ({
          userId,
          nickname: entry.nickname,
        })),
      );
    },
    [viewerUserWorkspaceId],
  );

  useEffect(() => {
    typingTickRef.current = window.setInterval(() => {
      flushTypingState();
    }, 600);

    return () => {
      if (typingTickRef.current) {
        window.clearInterval(typingTickRef.current);
      }
    };
  }, [flushTypingState]);

  const postTyping = useCallback(
    async (active: boolean) => {
      if (!token || (!channelId && !dmThreadId)) {
        return;
      }

      await fetch('/chat/typing', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelId,
          dmThreadId,
          active,
        }),
      }).catch(() => {});
    },
    [channelId, dmThreadId, token],
  );

  const fetchPinned = useCallback(async () => {
    if (!token || (!channelId && !dmThreadId)) {
      setPinnedMessages([]);
      return;
    }
    try {
      const params = new URLSearchParams();
      if (channelId) {
        params.set('channelId', channelId);
      }
      if (dmThreadId) {
        params.set('dmThreadId', dmThreadId);
      }
      const response = await fetch(`/chat/pins?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as unknown;
      setPinnedMessages(Array.isArray(data) ? (data as NativeChatPinnedMessage[]) : []);
    } catch {
      setPinnedMessages([]);
    }
  }, [channelId, dmThreadId, token]);

  const fetchMessages = useCallback(
    async (mode: 'full' | 'incremental') => {
      if (!token || (!channelId && !dmThreadId)) {
        setChannel(null);
        setMessages([]);
        setReadState(null);
        setLoadError(null);
        lastMessageAtRef.current = null;
        return;
      }

      if (mode === 'full') {
        setIsLoading(true);
        setLoadError(null);
      }
      try {
        const params = new URLSearchParams();
        if (channelId) {
          params.set('channelId', channelId);
        }
        if (dmThreadId) {
          params.set('dmThreadId', dmThreadId);
        }
        if (mode === 'incremental' && lastMessageAtRef.current) {
          params.set('after', lastMessageAtRef.current);
        }
        if (mode === 'incremental') {
          params.set('limit', '100');
        }

        const response = await fetch(`/chat/messages?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const msg = await parseFetchErrorMessage(
            response,
            'Unable to load messages',
          );
          throw new Error(msg);
        }

        const data = (await response.json()) as {
          messages: NativeChatMessage[];
          readState?: NativeChatReadState | null;
        };
        setChannel({ id: channelId ?? dmThreadId ?? '' });
        if (data.readState) {
          setReadState(data.readState);
        }
        if (mode === 'incremental') {
          setMessages((previousMessages) =>
            mergeNativeMessages(previousMessages, data.messages),
          );
        } else {
          setMessages(data.messages);
        }
        const latest =
          data.messages.length > 0
            ? data.messages[data.messages.length - 1].createdAt
            : null;
        if (latest) {
          lastMessageAtRef.current = latest;
        }
      } catch (fetchError) {
        if (mode === 'full') {
          setLoadError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Unable to load chat',
          );
        }
      }
      if (mode === 'full') {
        setIsLoading(false);
      }
    },
    [channelId, dmThreadId, token],
  );

  useEffect(() => {
    lastMessageAtRef.current = null;
    lastSseActivityRef.current = 0;
    streamAttemptRef.current = 0;
    typingByUserRef.current = new Map();
    setTypingMembers([]);
    setReadState(null);
    setPinnedMessages([]);
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    setHighlightMessageId(null);
  }, [conversationKey]);

  useEffect(() => {
    void fetchPinned();
  }, [fetchPinned]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void fetchMessages('full');
  }, [fetchMessages]);

  useEffect(() => {
    if (!token || (!channelId && !dmThreadId)) {
      return;
    }

    const params = new URLSearchParams();
    if (channelId) {
      params.set('channelId', channelId);
    }
    if (dmThreadId) {
      params.set('dmThreadId', dmThreadId);
    }

    const abortController = new AbortController();
    let cancelled = false;

    const runStream = async () => {
      while (!cancelled && !abortController.signal.aborted) {
        try {
          const response = await fetch(
            `/chat/messages/stream?${params.toString()}`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
              },
              signal: abortController.signal,
            },
          );

          if (!response.ok || !response.body) {
            streamAttemptRef.current += 1;
            const delay = Math.min(
              1000 * 2 ** Math.min(streamAttemptRef.current, 5),
              30_000,
            );
            await sleep(delay);
            continue;
          }

          streamAttemptRef.current = 0;
          lastSseActivityRef.current = Date.now();

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (!cancelled && !abortController.signal.aborted) {
            const chunk = await reader.read();
            if (chunk.done) {
              break;
            }
            buffer += decoder.decode(chunk.value, { stream: true });

            let parsed = parseSseEventBlocks(buffer);
            while (parsed.consumed) {
              buffer = parsed.rest;
              const { type: sseType, data } = parseSseBlock(parsed.consumed);

              if (sseType && data) {
                try {
                  const payload = JSON.parse(data) as { type?: string };
                  const eventKind = payload.type ?? sseType;
                  lastSseActivityRef.current = Date.now();

                  if (eventKind === 'message-created') {
                    void fetchMessages('incremental');
                    void fetchPinned();
                  } else if (
                    eventKind === 'reactions-updated' ||
                    eventKind === 'pins-updated'
                  ) {
                    void fetchMessages('full');
                    void fetchPinned();
                  } else if (eventKind === 'typing') {
                    const typingPayload = payload as {
                      type: 'typing';
                      userWorkspaceId: string;
                      active: boolean;
                      nickname?: string;
                    };
                    upsertTyping(
                      typingPayload.userWorkspaceId,
                      typingPayload.nickname ?? 'Member',
                      typingPayload.active !== false,
                    );
                  } else if (eventKind === 'read-updated') {
                    void fetchMessages('incremental');
                    onConversationRealtime?.();
                  }
                } catch {
                  lastSseActivityRef.current = Date.now();
                  if (sseType === 'message-created') {
                    void fetchMessages('incremental');
                    void fetchPinned();
                  }
                }
              }

              parsed = parseSseEventBlocks(buffer);
            }
          }
        } catch {
          if (cancelled || abortController.signal.aborted) {
            break;
          }
          streamAttemptRef.current += 1;
          const delay = Math.min(
            1000 * 2 ** Math.min(streamAttemptRef.current, 5),
            30_000,
          );
          await sleep(delay);
        }
      }
    };

    void runStream();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [
    channelId,
    dmThreadId,
    fetchMessages,
    fetchPinned,
    onConversationRealtime,
    token,
    upsertTyping,
  ]);

  useEffect(() => {
    if (!channelId && !dmThreadId) {
      return;
    }
    const POLL_MS = 1500;
    const SSE_QUIET_POLL_MS = 10_000;
    const timer = window.setInterval(() => {
      if (Date.now() - lastSseActivityRef.current < SSE_QUIET_POLL_MS) {
        return;
      }
      void fetchMessages('incremental');
    }, POLL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [channelId, dmThreadId, fetchMessages]);

  const sendMessage = async (text: string) => {
    if (!token || !text.trim() || (!channelId && !dmThreadId)) {
      return;
    }

    const trimmed = text.trim();
    const conversationKind = channelId ? 'channel' : 'dm';
    const convId =
      nativeConversationId?.trim() ||
      channelId ||
      dmThreadId ||
      '';

    const optimisticId = `${NATIVE_CHAT_OPTIMISTIC_ID_PREFIX}${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`}`;
    const viewerId = viewerUserWorkspaceId?.trim();
    const optimistic: NativeChatMessage | null =
      viewerId && convId
        ? {
            id: optimisticId,
            conversationKind,
            conversationId: convId,
            body: trimmed,
            kind: 'text',
            createdAt: new Date().toISOString(),
            sender: {
              userWorkspaceId: viewerId,
              firstName: viewerProfile?.firstName?.trim() ?? '',
              lastName: viewerProfile?.lastName?.trim() ?? '',
              avatarUrl: viewerProfile?.avatarUrl ?? null,
            },
            reactions: [],
            isPinned: false,
          }
        : null;

    if (optimistic) {
      setMessages((previousMessages) =>
        mergeNativeMessages(previousMessages, [optimistic]),
      );
    }

    const rollbackOptimistic = () => {
      if (!optimistic) {
        return;
      }
      setMessages((previousMessages) =>
        previousMessages.filter((m) => m.id !== optimisticId),
      );
    };

    try {
      const response = await fetch('/chat/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelId,
          dmThreadId,
          body: trimmed,
        }),
      });

      if (!response.ok) {
        rollbackOptimistic();
        const msg = await parseFetchErrorMessage(
          response,
          'Unable to send message',
        );
        throw new Error(msg);
      }

      let serverMessage: NativeChatMessage | null = null;
      try {
        serverMessage = (await response.json()) as NativeChatMessage;
      } catch {
        serverMessage = null;
      }

      if (serverMessage?.id) {
        setMessages((previousMessages) =>
          mergeNativeMessages(
            previousMessages.filter((m) => m.id !== optimisticId),
            [serverMessage as NativeChatMessage],
          ),
        );
        if (highlightTimeoutRef.current !== null) {
          window.clearTimeout(highlightTimeoutRef.current);
        }
        setHighlightMessageId(serverMessage.id);
        highlightTimeoutRef.current = window.setTimeout(() => {
          setHighlightMessageId(null);
          highlightTimeoutRef.current = null;
        }, 2200);
      } else {
        rollbackOptimistic();
      }

      await fetchMessages('incremental');
    } catch (e) {
      rollbackOptimistic();
      throw e;
    }
  };

  const markAsRead = (upToMessageId?: string | null) => {
    if (!token || (!channelId && !dmThreadId)) {
      return;
    }
    void fetch('/chat/messages/read', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channelId,
        dmThreadId,
        ...(upToMessageId ? { upToMessageId } : {}),
      }),
    }).catch(() => {});
  };

  const sendTypingStart = () => {
    const now = Date.now();
    if (now - lastTypingPostRef.current >= TYPING_POST_MIN_INTERVAL_MS) {
      lastTypingPostRef.current = now;
      void postTyping(true);
    }
  };

  const sendTypingEnd = () => {
    void postTyping(false);
  };

  const reload = () => {
    void fetchMessages('full');
  };

  const reloadPins = useCallback(() => {
    void fetchPinned();
  }, [fetchPinned]);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string, remove: boolean) => {
      if (!token) {
        return;
      }
      const method = remove ? 'DELETE' : 'POST';
      const query = remove
        ? `?emoji=${encodeURIComponent(emoji)}`
        : '';
      const response = await fetch(
        `/chat/messages/${encodeURIComponent(messageId)}/reactions${query}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(method === 'POST'
              ? { 'Content-Type': 'application/json' }
              : {}),
          },
          body: method === 'POST' ? JSON.stringify({ emoji }) : undefined,
        },
      );
      if (!response.ok) {
        const msg = await parseFetchErrorMessage(
          response,
          'Unable to update reaction',
        );
        throw new Error(msg);
      }
      await fetchMessages('full');
    },
    [fetchMessages, token],
  );

  const pinMessage = useCallback(
    async (messageId: string) => {
      if (!token) {
        return;
      }
      const response = await fetch(
        `/chat/messages/${encodeURIComponent(messageId)}/pin`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!response.ok) {
        const msg = await parseFetchErrorMessage(
          response,
          'Unable to pin message',
        );
        throw new Error(msg);
      }
      await fetchMessages('full');
      await fetchPinned();
    },
    [fetchMessages, fetchPinned, token],
  );

  const unpinMessage = useCallback(
    async (messageId: string) => {
      if (!token) {
        return;
      }
      const response = await fetch(
        `/chat/messages/${encodeURIComponent(messageId)}/pin`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!response.ok) {
        const msg = await parseFetchErrorMessage(
          response,
          'Unable to unpin message',
        );
        throw new Error(msg);
      }
      await fetchMessages('full');
      await fetchPinned();
    },
    [fetchMessages, fetchPinned, token],
  );

  return {
    channel,
    messages,
    pinnedMessages,
    readState,
    isLoading,
    loadError,
    typingMembers,
    sendMessage,
    markAsRead,
    sendTypingStart,
    sendTypingEnd,
    reload,
    reloadPins,
    toggleReaction,
    pinMessage,
    unpinMessage,
    highlightMessageId,
  };
};

const mergeNativeMessages = (
  previousMessages: NativeChatMessage[],
  incomingMessages: NativeChatMessage[],
): NativeChatMessage[] => {
  if (incomingMessages.length === 0) {
    return previousMessages;
  }

  const byId = new Map(previousMessages.map((message) => [message.id, message]));
  for (const message of incomingMessages) {
    byId.set(message.id, message);
  }

  return Array.from(byId.values()).sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
};
