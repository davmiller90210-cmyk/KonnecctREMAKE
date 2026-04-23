export type ChatWorkspaceLayoutChannel = {
  id: string;
  name: string;
  slug: string;
  visibility: 'public' | 'private';
  canRead: boolean;
  canPost: boolean;
  canManage: boolean;
  agoraGroupId: string | null;
  sendbirdChannelUrl: string | null;
  nativeConversationKind: 'channel';
  nativeConversationId: string;
  unreadCount: number;
};

export type ChatWorkspaceLayoutCategory = {
  id: string;
  name: string;
  position: number;
  channels: ChatWorkspaceLayoutChannel[];
};

export type ChatWorkspaceLayoutDm = {
  id: string;
  kind: 'direct' | 'group';
  title: string | null;
  agoraGroupId: string | null;
  sendbirdChannelUrl: string | null;
  peerAgoraUserId: string | null;
  nativeConversationKind: 'dm';
  nativeConversationId: string;
  unreadCount: number;
};

export type ChatWorkspaceMemberOption = {
  userWorkspaceId: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Profile image from CRM (also used for Sendbird). */
  avatarUrl: string | null;
  /** Same id the Stream client uses for this user in this workspace. */
  streamUserId: string;
};

export type ChatWorkspaceLayoutResponse = {
  categories: ChatWorkspaceLayoutCategory[];
  directThreads: ChatWorkspaceLayoutDm[];
  /** In-app notifications (new messages in channels/DMs) not yet marked read */
  notificationUnreadCount: number;
  workspaceMembers: ChatWorkspaceMemberOption[];
  viewer: {
    userWorkspaceId: string;
    isWorkspaceAdmin: boolean;
  };
};

/** Active conversation in the Sendbird editorial hub (channel or DM). */
export type ChatHubSelection =
  | { kind: 'channel'; channel: ChatWorkspaceLayoutChannel }
  | { kind: 'dm'; dm: ChatWorkspaceLayoutDm };
