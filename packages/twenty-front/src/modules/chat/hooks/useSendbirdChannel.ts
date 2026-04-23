import {
  type NativeChatMessage,
  type NativeTypingMember,
} from '@/chat/types/native-chat-message.type';
import {
  getNativeMessageSenderId,
  nativeMessageBody,
  useNativeChatChannel,
} from '@/chat/hooks/useNativeChatChannel';

type UseSendbirdChannelOptions = {
  channelId: string | null;
  dmThreadId: string | null;
};

type UseSendbirdChannelResult = {
  channel: { id: string } | null;
  messages: NativeChatMessage[];
  isLoading: boolean;
  error: string | null;
  typingMembers: NativeTypingMember[];
  sendMessage: (text: string) => Promise<void>;
  sendFile: (_file: File) => Promise<void>;
  markAsRead: () => void;
  sendTypingStart: (_nickname?: string) => void;
  sendTypingEnd: () => void;
  reload: () => void;
};

export const messageBody = nativeMessageBody;

export const getMessageSenderId = (
  message: NativeChatMessage,
): string | undefined => {
  return getNativeMessageSenderId(message);
};

export const useSendbirdChannel = ({
  channelId,
  dmThreadId,
}: UseSendbirdChannelOptions): UseSendbirdChannelResult => {
  const native = useNativeChatChannel({
    channelId,
    dmThreadId,
  });

  return {
    channel: native.channel,
    messages: native.messages,
    isLoading: native.isLoading,
    error: native.loadError,
    typingMembers: native.typingMembers,
    sendMessage: native.sendMessage,
    sendFile: async () => {
      // Native path has no upload API; keep signature for legacy callers.
    },
    markAsRead: () => {
      native.markAsRead(null);
    },
    sendTypingStart: native.sendTypingStart,
    sendTypingEnd: native.sendTypingEnd,
    reload: native.reload,
  };
};
