export type NativeChatReadState = {
  viewerLastReadAt: string | null;
  others: Array<{
    userWorkspaceId: string;
    lastReadAt: string | null;
    firstName: string;
    lastName: string;
  }>;
};
