export type MattermostTeam = {
  id: string;
  name: string;
  display_name: string;
};

export type MattermostChannel = {
  id: string;
  name: string;
  display_name: string;
  type: 'O' | 'P' | 'D' | 'G';
  team_id: string;
};

export type MattermostPost = {
  id: string;
  channel_id: string;
  user_id: string;
  message: string;
  create_at: number;
  root_id?: string;
  parent_id?: string;
  reply_count?: number;
  file_ids?: string[];
  metadata?: {
    reactions?: Array<{
      user_id: string;
      emoji_name: string;
      post_id?: string;
      create_at?: number;
    }>;
    files?: unknown;
  };
};

export type MattermostPostsPage = {
  order: string[];
  posts: Record<string, MattermostPost>;
};

export type MattermostUser = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
};

export type MattermostSession = {
  baseUrl: string;
  token: string;
  mattermostUserId: string;
};
