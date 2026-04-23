export type NativeChatReactionSummary = {
  emoji: string;
  count: number;
  viewerReacted: boolean;
};

/** CRM @mention snapshot from server (stable at send time; may be redacted per viewer). */
export type NativeChatCrmMentionSnapshot = {
  objectNameSingular: string;
  recordId: string;
  displayName: string;
  objectLabel: string;
  imageUrl: string | null;
  ownerDisplayLabel: string | null;
  restricted?: boolean;
};

export type NativeChatMessage = {
  id: string;
  conversationKind: 'channel' | 'dm';
  conversationId: string;
  body: string;
  kind: 'text' | 'system';
  createdAt: string;
  editedAt?: string | null;
  isDeleted?: boolean;
  sender: {
    userWorkspaceId: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  } | null;
  reactions?: NativeChatReactionSummary[];
  isPinned?: boolean;
  crmMentionSnapshots?: NativeChatCrmMentionSnapshot[];
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
