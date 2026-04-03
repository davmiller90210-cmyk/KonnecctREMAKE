export type ChatWorkspaceLayoutChannel = {
  id: string;
  name: string;
  slug: string;
  visibility: 'public' | 'private';
  canRead: boolean;
  canPost: boolean;
  canManage: boolean;
  agoraGroupId: string | null;
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
  peerAgoraUserId: string | null;
};

export type ChatWorkspaceLayoutResponse = {
  categories: ChatWorkspaceLayoutCategory[];
  directThreads: ChatWorkspaceLayoutDm[];
  viewer: {
    userWorkspaceId: string;
    isWorkspaceAdmin: boolean;
  };
};

export type ChatWorkspaceMemberOption = {
  userWorkspaceId: string;
  firstName: string;
  lastName: string;
  email: string;
};
