export type NativeChatReactionSummary = {
  emoji: string;
  count: number;
  viewerReacted: boolean;
};

export type NativeChatMessage = {
  id: string;
  conversationKind: 'channel' | 'dm';
  conversationId: string;
  body: string;
  kind: 'text' | 'system';
  createdAt: string;
  sender: {
    userWorkspaceId: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  } | null;
  reactions?: NativeChatReactionSummary[];
  isPinned?: boolean;
};

export type NativeChatPinnedMessage = {
  id: string;
  messageId: string;
  bodyPreview: string;
  createdAt: string;
};

export type NativeTypingMember = {
  userId: string;
  nickname: string;
};
