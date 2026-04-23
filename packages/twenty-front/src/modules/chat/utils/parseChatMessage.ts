/**
 * Lightweight tokenizer for chat message bodies.
 *
 * Recognises markdown-style links `[@Label](target)` and turns them into
 * mention nodes. Bare http(s) URLs become plain link nodes. Markdown images
 * `![alt](url)` become image nodes. Everything else becomes a text node.
 */

export type ChatTextNode = { type: 'text'; value: string };

export type ChatLinkNode = {
  type: 'link';
  label: string;
  href: string;
};

export type ChatImageNode = {
  type: 'image';
  alt: string;
  href: string;
};

export type ChatMentionNode = {
  type: 'mention';
  label: string;
  kind: 'record' | 'user' | 'agent' | 'konnecctai' | 'unknown';
  /** CRM object (e.g. `person`, `company`). Only set for `record`. */
  objectNameSingular?: string;
  /** CRM record id. Only set for `record`, `agent`, `konnecctai`. */
  recordId?: string;
  /** Sendbird scoped user id. Only set for `user`. */
  userId?: string;
  /** Original target string (http URL or twenty://… URI). */
  href: string;
};

export type ChatNode =
  | ChatTextNode
  | ChatLinkNode
  | ChatImageNode
  | ChatMentionNode;

const LINK_REGEX = /(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g;
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
const URL_REGEX = /\bhttps?:\/\/[^\s<>"']+/g;

const classifyMentionTarget = (
  label: string,
  target: string,
): ChatMentionNode => {
  const base: ChatMentionNode = {
    type: 'mention',
    label,
    kind: 'unknown',
    href: target,
  };

  if (target.startsWith('twenty://record/')) {
    const rest = target.slice('twenty://record/'.length);
    const [objectNameSingular, recordId] = rest.split('/');

    if (objectNameSingular && recordId) {
      return {
        ...base,
        kind: 'record',
        objectNameSingular,
        recordId,
      };
    }

    return base;
  }

  if (target.startsWith('twenty://agent/')) {
    const recordId = target.slice('twenty://agent/'.length);
    return { ...base, kind: 'agent', recordId };
  }

  if (target.startsWith('twenty://konnecctai')) {
    return { ...base, kind: 'konnecctai' };
  }

  if (target.startsWith('twenty://user/')) {
    const userId = target.slice('twenty://user/'.length);
    return { ...base, kind: 'user', userId };
  }

  // Legacy format: https://<origin>/objects/<object>/<recordId>
  try {
    const url = new URL(target);
    const match = url.pathname.match(/^\/objects\/([^/]+)\/([^/]+)$/);

    if (match) {
      return {
        ...base,
        kind: 'record',
        objectNameSingular: match[1],
        recordId: match[2],
      };
    }
  } catch {
    // not a URL → fall through
  }

  return base;
};

const splitPlainText = (value: string): ChatNode[] => {
  if (value.length === 0) {
    return [];
  }

  const nodes: ChatNode[] = [];
  let cursor = 0;

  URL_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = URL_REGEX.exec(value);

  while (match !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (start > cursor) {
      nodes.push({ type: 'text', value: value.slice(cursor, start) });
    }

    nodes.push({ type: 'link', label: match[0], href: match[0] });
    cursor = end;
    match = URL_REGEX.exec(value);
  }

  if (cursor < value.length) {
    nodes.push({ type: 'text', value: value.slice(cursor) });
  }

  return nodes;
};

type NextToken =
  | { kind: 'image'; match: RegExpExecArray }
  | { kind: 'link'; match: RegExpExecArray };

const findNextMarkdownToken = (input: string, fromIndex: number): NextToken | null => {
  IMAGE_REGEX.lastIndex = fromIndex;
  LINK_REGEX.lastIndex = fromIndex;
  const imageMatch = IMAGE_REGEX.exec(input);
  const linkMatch = LINK_REGEX.exec(input);

  if (!imageMatch && !linkMatch) {
    return null;
  }

  if (!imageMatch) {
    return { kind: 'link', match: linkMatch as RegExpExecArray };
  }

  if (!linkMatch) {
    return { kind: 'image', match: imageMatch };
  }

  return imageMatch.index <= linkMatch.index
    ? { kind: 'image', match: imageMatch }
    : { kind: 'link', match: linkMatch };
};

export const parseChatMessage = (input: string): ChatNode[] => {
  if (!input) {
    return [];
  }

  const nodes: ChatNode[] = [];
  let cursor = 0;

  let next = findNextMarkdownToken(input, cursor);

  while (next !== null) {
    const start = next.match.index;
    const end = start + next.match[0].length;

    if (start > cursor) {
      nodes.push(...splitPlainText(input.slice(cursor, start)));
    }

    if (next.kind === 'image') {
      const [, alt, href] = next.match;

      nodes.push({
        type: 'image',
        alt: alt ?? '',
        href: href ?? '',
      });
    } else {
      const [, label, target] = next.match;

      if (label.startsWith('@')) {
        nodes.push(classifyMentionTarget(label.slice(1), target));
      } else {
        nodes.push({ type: 'link', label, href: target });
      }
    }

    cursor = end;
    next = findNextMarkdownToken(input, cursor);
  }

  if (cursor < input.length) {
    nodes.push(...splitPlainText(input.slice(cursor)));
  }

  return nodes;
};

/**
 * Returns the list of scoped-user ids mentioned as `[@name](twenty://user/<id>)`
 * in the message body. Useful for deciding whether to fire a "you were mentioned"
 * notification.
 */
export const getMentionedUserIds = (input: string): string[] => {
  return parseChatMessage(input)
    .filter(
      (node): node is ChatMentionNode =>
        node.type === 'mention' && node.kind === 'user' && !!node.userId,
    )
    .map((node) => node.userId as string);
};
