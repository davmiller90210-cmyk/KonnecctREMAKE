import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { chatUnreadMapState } from '@/chat/states/chatUnreadState';
import { type ChatWorkspaceLayoutResponse } from '@/chat/types/chat-workspace-layout.type';
import {
  parseSseBlock,
  parseSseEventBlocks,
} from '@/chat/utils/parseChatSse';
import { chatRecordLinksInvalidateState } from '@/chat/states/chatRecordLinksInvalidateState';
import { notifyIncomingChatIfBackground } from '@/chat/utils/chat-desktop-notify';

type ChatInboxSsePayload = {
  type?: string;
  reason?:
    | 'new-message'
    | 'message-edited'
    | 'message-deleted'
    | 'record-links-changed'
    | 'user-mentioned';
  objectNameSingular?: string;
  recordId?: string;
  conversationKind?: 'channel' | 'dm';
  conversationId?: string;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const useChatWorkspaceLayout = () => {
  const tokenPair = useAtomValue(tokenPairState.atom);
  const setUnreadMap = useSetAtom(chatUnreadMapState.atom);
  const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  const [layout, setLayout] = useState<ChatWorkspaceLayoutResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const layoutRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  /** Avoid flashing "Connecting…" on periodic / SSE-driven layout refreshes. */
  const layoutExistsRef = useRef(false);
  const lastDesktopNotifiedIdRef = useRef<string | null>(null);

  useEffect(() => {
    layoutExistsRef.current = layout !== null;
  }, [layout]);

  const reload = useCallback(async () => {
    if (!token) {
      layoutExistsRef.current = false;
      setLayout(null);
      setIsLoading(false);
      setUnreadMap({});
      return;
    }

    const showBlockingLoading = !layoutExistsRef.current;
    if (showBlockingLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('/chat/layout', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        let detail = text.trim() || `HTTP ${response.status}`;

        try {
          const parsed = JSON.parse(text) as { message?: string | string[] };
          const msg = parsed.message;

          if (msg) {
            detail = Array.isArray(msg) ? msg.join(', ') : msg;
          }
        } catch {
          // keep plain-text body
        }

        throw new Error(detail);
      }

      const parsed = (await response.json()) as ChatWorkspaceLayoutResponse;
      const data: ChatWorkspaceLayoutResponse = {
        ...parsed,
        notificationUnreadCount: parsed.notificationUnreadCount ?? 0,
        workspaceMembers: parsed.workspaceMembers ?? [],
      };
      setLayout(data);
      const notificationUnread = data.notificationUnreadCount;
      const nextUnreadMap = Object.fromEntries(
        [
          ...data.categories.flatMap((category) =>
            category.channels.map((channel) => [
              `channel:${channel.nativeConversationId}`,
              channel.unreadCount,
            ]),
          ),
          ...data.directThreads.map((thread) => [
            `dm:${thread.nativeConversationId}`,
            thread.unreadCount,
          ]),
          ...(notificationUnread > 0
            ? [['in-app-notifications', notificationUnread] as const]
            : []),
        ].filter((entry) => Number(entry[1]) > 0),
      );
      setUnreadMap(nextUnreadMap);
      layoutExistsRef.current = true;
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : 'Unknown error',
      );
      setLayout(null);
      layoutExistsRef.current = false;
      setUnreadMap({});
    } finally {
      if (showBlockingLoading) {
        setIsLoading(false);
      }
    }
  }, [setUnreadMap, token]);

  const scheduleReload = useCallback(
    (delayMs: number = 350) => {
      if (layoutRefreshTimerRef.current) {
        clearTimeout(layoutRefreshTimerRef.current);
      }
      layoutRefreshTimerRef.current = setTimeout(() => {
        layoutRefreshTimerRef.current = null;
        void reload();
      }, delayMs);
    },
    [reload],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const interval = window.setInterval(() => {
      void reload();
    }, 12_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [reload, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;
    let attempt = 0;

    const fetchAndMaybeNotifyDesktop = async () => {
      try {
        const response = await fetch('/chat/notifications?limit=8', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as {
          notifications?: Array<{
            id: string;
            bodyPreview: string;
            readAt: string | null;
          }>;
        };
        const firstUnread = data.notifications?.find((row) => !row.readAt);
        if (
          !firstUnread ||
          firstUnread.id === lastDesktopNotifiedIdRef.current
        ) {
          return;
        }
        lastDesktopNotifiedIdRef.current = firstUnread.id;
        notifyIncomingChatIfBackground({
          title: 'New chat message',
          body: firstUnread.bodyPreview,
          tag: `konnecct-chat-${firstUnread.id}`,
        });
      } catch {
        // ignore
      }
    };

    const runInboxStream = async () => {
      while (!cancelled && !abortController.signal.aborted) {
        try {
          const response = await fetch('/chat/notifications/stream', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: abortController.signal,
          });

          if (!response.ok || !response.body) {
            attempt += 1;
            await sleep(Math.min(1000 * 2 ** Math.min(attempt, 5), 30_000));
            continue;
          }

          attempt = 0;
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
                  const payload = JSON.parse(data) as ChatInboxSsePayload;
                  const eventKind = payload.type ?? sseType;
                  if (eventKind === 'notification-updated') {
                    if (payload.reason === 'record-links-changed') {
                      setRecordLinksInvalidate((prev) => ({
                        nonce: prev.nonce + 1,
                        objectNameSingular: payload.objectNameSingular,
                        recordId: payload.recordId,
                      }));
                    }
                    const fastReason =
                      payload.reason === 'message-edited' ||
                      payload.reason === 'message-deleted' ||
                      payload.reason === 'new-message';
                    scheduleReload(fastReason ? 120 : 350);
                    void fetchAndMaybeNotifyDesktop();
                  }
                } catch {
                  if (sseType === 'notification-updated') {
                    scheduleReload();
                    void fetchAndMaybeNotifyDesktop();
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
          attempt += 1;
          await sleep(Math.min(1000 * 2 ** Math.min(attempt, 5), 30_000));
        }
      }
    };

    void runInboxStream();

    return () => {
      cancelled = true;
      abortController.abort();
      if (layoutRefreshTimerRef.current) {
        clearTimeout(layoutRefreshTimerRef.current);
        layoutRefreshTimerRef.current = null;
      }
    };
  }, [scheduleReload, setRecordLinksInvalidate, token]);

  return {
    layout,
    isLoading,
    error,
    reload,
  };
};
