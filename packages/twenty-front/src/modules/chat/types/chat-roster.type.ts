export type ChatRosterMember = {
  userWorkspaceId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export type ChatRosterResponse = {
  members: ChatRosterMember[];
};
