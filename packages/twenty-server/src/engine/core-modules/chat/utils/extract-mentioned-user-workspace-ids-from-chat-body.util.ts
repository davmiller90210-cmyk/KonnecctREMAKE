/**
 * Parses `[@label](twenty://user/<userWorkspaceId>)` tokens from native chat bodies.
 * Matches the client markdown shape used by ChatComposer / parseChatMessage.
 */
const USER_MENTION_LINK_PATTERN =
  /\[@([^\]]*)\]\(twenty:\/\/user\/([^)\s]+)\)/g;

export const extractMentionedUserWorkspaceIdsFromChatBody = (
  body: string,
): string[] => {
  const ids: string[] = [];
  const seen = new Set<string>();

  USER_MENTION_LINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = USER_MENTION_LINK_PATTERN.exec(body);

  while (match !== null) {
    const id = match[2]?.trim();

    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
    match = USER_MENTION_LINK_PATTERN.exec(body);
  }

  return ids;
};
