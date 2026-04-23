/** Small curated set shown on every message; other emojis still render from the server. */
export const CHAT_QUICK_REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '👀'] as const;

export type ChatQuickReactionEmoji =
  (typeof CHAT_QUICK_REACTION_EMOJIS)[number];
