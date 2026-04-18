/* eslint-disable twenty/no-state-useref -- Sendbird handlers capture refs across async events */
import {
  GroupChannelHandler,
  MessageCollectionInitPolicy,
  type GroupChannel,
  type GroupChannelCollection,
} from '@sendbird/chat/groupChannel';
import {
  MessageFilter,
  MessageType,
  type BaseMessage,
  type FileMessage,
  type Member,
  type UserMessage,
} from '@sendbird/chat/message';
import { useEffect, useRef, useState } from 'react';

import { useSendbirdClient } from '@/chat/providers/SendbirdClientProvider';

const HANDLER_KEY = 'konnecct-chat-page-handler';

type UseSendbirdChannelOptions = {
  channelUrl: string | null;
};

type UseSendbirdChannelResult = {
  channel: GroupChannel | null;
  messages: BaseMessage[];
  isLoading: boolean;
  error: string | null;
  typingMembers: Member[];
  sendMessage: (text: string) => Promise<void>;
  sendFile: (file: File) => Promise<void>;
  markAsRead: () => void;
  sendTypingStart: () => void;
  sendTypingEnd: () => void;
  reload: () => void;
};

export const messageBody = (message: BaseMessage): string => {
  if (message.messageType === MessageType.USER) {
    return (message as UserMessage).message;
  }
  if (message.messageType === MessageType.FILE) {
    return (message as FileMessage).name || 'File';
  }
  if (message.messageType === MessageType.ADMIN) {
    return message.message || '';
  }
  return '';
};

export const getMessageSenderId = (
  message: BaseMessage,
): string | undefined => {
  if (message.messageType === MessageType.USER) {
    return (message as UserMessage).sender?.userId;
  }
  if (message.messageType === MessageType.FILE) {
    return (message as FileMessage).sender?.userId;
  }
  return undefined;
};

export const useSendbirdChannel = ({
  channelUrl,
}: UseSendbirdChannelOptions): UseSendbirdChannelResult => {
  const { sb, setActiveChannelUrl } = useSendbirdClient();

  const [channel, setChannel] = useState<GroupChannel | null>(null);
  const [messages, setMessages] = useState<BaseMessage[]>([]);
  const [typingMembers, setTypingMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collectionRef = useRef<GroupChannelCollection | null>(null);
  const activeUrlRef = useRef<string | null>(null);
  activeUrlRef.current = channelUrl;

  useEffect(() => {
    setActiveChannelUrl(channelUrl);
    return () => {
      setActiveChannelUrl(null);
    };
  }, [channelUrl, setActiveChannelUrl]);

  useEffect(() => {
    if (!sb || !channelUrl) {
      setChannel(null);
      setMessages([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const groupChannel = await sb.groupChannel.getChannel(channelUrl);
        if (cancelled) return;
        setChannel(groupChannel);

        const filter = new MessageFilter();
        const collection = groupChannel.createMessageCollection({
          filter,
          limit: 50,
          startingPoint: Date.now(),
        });

        collection.setMessageCollectionHandler({
          onMessagesAdded: (_context, _ch, added) => {
            if (activeUrlRef.current !== channelUrl) return;
            setMessages((prev) => mergeMessages(prev, added));
          },
          onMessagesUpdated: (_context, _ch, updated) => {
            if (activeUrlRef.current !== channelUrl) return;
            setMessages((prev) => mergeMessages(prev, updated));
          },
          onMessagesDeleted: (_context, _ch, _ids, deleted) => {
            if (activeUrlRef.current !== channelUrl) return;
            const deletedIds = new Set(
              deleted.map((m) => (m as BaseMessage).messageId),
            );
            setMessages((prev) =>
              prev.filter((m) => !deletedIds.has(m.messageId)),
            );
          },
          onChannelUpdated: () => {
            if (activeUrlRef.current !== channelUrl) return;
            setChannel(groupChannel);
          },
          onChannelDeleted: () => {
            if (activeUrlRef.current !== channelUrl) return;
            setChannel(null);
          },
          onHugeGapDetected: () => {
            /* noop */
          },
        });

        const initial = await collection
          .initialize(MessageCollectionInitPolicy.CACHE_AND_REPLACE_BY_API)
          .onCacheResult((_, cached) => {
            if (activeUrlRef.current !== channelUrl) return;
            setMessages(cached);
          })
          .onApiResult((_, apiMessages) => {
            if (activeUrlRef.current !== channelUrl) return;
            setMessages(apiMessages);
          });

        if (cancelled) {
          initial.dispose();
          return;
        }

        collectionRef.current = initial;

        try {
          await groupChannel.markAsRead();
        } catch {
          /* noop */
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load channel');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    const channelHandler = new GroupChannelHandler({
      onTypingStatusUpdated: (ch) => {
        if (ch.url !== activeUrlRef.current) return;
        setTypingMembers(ch.getTypingUsers());
      },
    });

    sb.groupChannel.addGroupChannelHandler(HANDLER_KEY, channelHandler);

    void load();

    return () => {
      cancelled = true;
      sb.groupChannel.removeGroupChannelHandler(HANDLER_KEY);
      if (collectionRef.current) {
        collectionRef.current.dispose();
        collectionRef.current = null;
      }
      setTypingMembers([]);
    };
  }, [sb, channelUrl]);

  const sendMessage = async (text: string) => {
    if (!channel || !text.trim()) return;
    const params = { message: text };
    await new Promise<void>((resolve, reject) => {
      channel
        .sendUserMessage(params)
        .onPending((pending) => {
          setMessages((prev) => mergeMessages(prev, [pending]));
        })
        .onFailed((err) => {
          reject(err);
        })
        .onSucceeded((sent) => {
          setMessages((prev) => mergeMessages(prev, [sent]));
          resolve();
        });
    });
  };

  const sendFile = async (file: File) => {
    if (!channel) return;
    await new Promise<void>((resolve, reject) => {
      channel
        .sendFileMessage({ file })
        .onPending((pending) => {
          setMessages((prev) => mergeMessages(prev, [pending]));
        })
        .onFailed((err) => {
          reject(err);
        })
        .onSucceeded((sent) => {
          setMessages((prev) => mergeMessages(prev, [sent]));
          resolve();
        });
    });
  };

  const markAsRead = () => {
    if (!channel) return;
    void channel.markAsRead().catch(() => {});
  };

  const sendTypingStart = () => {
    if (!channel) return;
    try {
      channel.startTyping();
    } catch {
      /* noop */
    }
  };

  const sendTypingEnd = () => {
    if (!channel) return;
    try {
      channel.endTyping();
    } catch {
      /* noop */
    }
  };

  const reload = () => {
    if (!channel) return;
    void channel
      .markAsRead()
      .catch(() => {})
      .then(() => {
        /* messages will resync via collection */
      });
  };

  return {
    channel,
    messages,
    isLoading,
    error,
    typingMembers,
    sendMessage,
    sendFile,
    markAsRead,
    sendTypingStart,
    sendTypingEnd,
    reload,
  };
};

const mergeMessages = (
  prev: BaseMessage[],
  incoming: BaseMessage[],
): BaseMessage[] => {
  if (incoming.length === 0) return prev;

  const map = new Map<number, BaseMessage>();
  for (const m of prev) {
    map.set(m.messageId, m);
  }
  for (const m of incoming) {
    map.set(m.messageId, m);
  }

  return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
};
