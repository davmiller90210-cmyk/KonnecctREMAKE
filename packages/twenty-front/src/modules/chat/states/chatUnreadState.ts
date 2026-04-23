import { atom } from 'jotai';
import { selectAtom } from 'jotai/utils';

import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

/** Unread message count per native conversation key (channel:<id> | dm:<id>). */
export const chatUnreadMapState = createAtomState<Record<string, number>>({
  key: 'chatUnreadMapState',
  defaultValue: {},
});

/** Total unread across every chat channel. */
export const chatTotalUnreadState = atom((get) => {
  const map = get(chatUnreadMapState.atom);
  let total = 0;

  for (const value of Object.values(map)) {
    total += value;
  }

  return total;
});

export const selectChannelUnread = (conversationKey: string) =>
  selectAtom(chatUnreadMapState.atom, (map) => map[conversationKey] ?? 0);
