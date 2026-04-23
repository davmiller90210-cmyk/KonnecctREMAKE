import { useEffect } from 'react';

import { type ChatWorkspaceLayoutResponse } from '@/chat/types/chat-workspace-layout.type';

const totalUnreadCount = (layout: ChatWorkspaceLayoutResponse | null): number => {
  if (!layout) {
    return 0;
  }
  let n = layout.notificationUnreadCount;
  for (const category of layout.categories) {
    for (const channel of category.channels) {
      if (channel.canRead) {
        n += channel.unreadCount;
      }
    }
  }
  for (const thread of layout.directThreads) {
    n += thread.unreadCount;
  }
  return n;
};

/**
 * Prefixes the document title with `(n) ` when chat has unread items (channels, DMs, in-app notifications).
 * Strips the prefix on unmount.
 */
export const useChatDocumentTitle = (
  layout: ChatWorkspaceLayoutResponse | null,
) => {
  useEffect(() => {
    const total = totalUnreadCount(layout);
    const prefixMatch = document.title.match(/^\((\d+)\)\s+/);
    const baseTitle = prefixMatch
      ? document.title.slice(prefixMatch[0].length)
      : document.title;

    if (total > 0) {
      document.title = `(${total}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }

    return () => {
      const pm = document.title.match(/^\((\d+)\)\s+/);
      if (pm) {
        document.title = document.title.slice(pm[0].length);
      }
    };
  }, [layout]);
};
