import { type MattermostPost } from '@/chat/mattermost-client/mattermost-api.types';

export type MattermostReactionRow = {
  user_id: string;
  emoji_name: string;
};

export const getMattermostReactions = (
  post: MattermostPost,
): MattermostReactionRow[] => {
  const meta = post.metadata;

  if (!meta || typeof meta !== 'object' || !('reactions' in meta)) {
    return [];
  }

  const raw = (meta as { reactions?: unknown }).reactions;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter(
    (x): x is MattermostReactionRow =>
      typeof x === 'object' &&
      x !== null &&
      'user_id' in x &&
      'emoji_name' in x &&
      typeof (x as MattermostReactionRow).user_id === 'string' &&
      typeof (x as MattermostReactionRow).emoji_name === 'string',
  );
};

export const userHasMattermostReaction = (
  post: MattermostPost,
  mattermostUserId: string,
  emojiName: string,
): boolean =>
  getMattermostReactions(post).some(
    (r) => r.user_id === mattermostUserId && r.emoji_name === emojiName,
  );
