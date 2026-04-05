import { type ChatMessage } from '@/chat/states/agoraSessionState';

const isSkippableAgoraType = (type: string | undefined) =>
  type === 'read' ||
  type === 'delivery' ||
  type === 'channel' ||
  type === 'cmd';

const resolveConversationIdFromAgoraMessage = (
  msg: { chatType?: string; type?: string; from?: string; to?: string },
  currentUserId: string | undefined,
): string | null => {
  const isGroup =
    msg.chatType === 'groupChat' ||
    msg.chatType === 'groupchat' ||
    msg.type === 'groupchat';

  if (isGroup && msg.to) {
    return msg.to;
  }

  if (!msg.from || !msg.to) {
    return null;
  }

  return currentUserId === msg.from ? msg.to : msg.from;
};

export const agoraPayloadToChatMessage = (
  msg: Record<string, unknown>,
  currentUserId: string | undefined,
): ChatMessage | null => {
  const type = msg.type as string | undefined;

  if (!type || isSkippableAgoraType(type)) {
    return null;
  }

  const from = (msg.from as string) || '';
  const to = (msg.to as string) || '';
  const conversationId = resolveConversationIdFromAgoraMessage(
    {
      chatType: msg.chatType as string | undefined,
      type,
      from,
      to,
    },
    currentUserId,
  );

  if (!conversationId) {
    return null;
  }

  const ext = msg.ext as { senderName?: string } | undefined;

  const base = {
    id: (msg.id as string) || `${from}-${msg.time}-${Math.random()}`,
    conversationId,
    senderId: from,
    senderName: ext?.senderName || from,
    createdAt: (msg.time as number) || Date.now(),
    status: 'delivered' as const,
    direction:
      currentUserId && from === currentUserId ? ('out' as const) : ('in' as const),
  };

  switch (type) {
    case 'txt':
      return {
        ...base,
        type: 'txt',
        text: (msg.msg as string) || '',
      };
    case 'img': {
      const url = (msg.url as string) || '';

      return {
        ...base,
        type: 'img',
        url,
        imageUrls: url ? [url] : [],
      };
    }
    case 'file':
      return {
        ...base,
        type: 'file',
        url: (msg.url as string) || undefined,
        filename: (msg.filename as string) || 'Attachment',
      };
    case 'audio':
      return {
        ...base,
        type: 'audio',
        url: (msg.url as string) || '',
      };
    case 'video':
      return {
        ...base,
        type: 'video',
        url: (msg.url as string) || '',
      };
    case 'custom':
      return {
        ...base,
        type: 'custom',
        text: typeof msg.msg === 'string' ? msg.msg : undefined,
      };
    default:
      return null;
  }
};
