import { formatDistanceToNow } from 'date-fns';

import { type MattermostChannel } from '@/chat/mattermost-client/mattermost-api.types';

/** Relative time for Mattermost post timestamps (ms or s); never throws. */
export const formatMattermostRelativeTime = (
  createAt: number | undefined | null,
): string => {
  if (createAt == null || !Number.isFinite(createAt)) {
    return '';
  }

  const d = new Date(createAt);

  if (Number.isNaN(d.getTime())) {
    return '';
  }

  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '';
  }
};

export const compareMattermostChannels = (
  a: MattermostChannel,
  b: MattermostChannel,
): number => {
  const left = (a.display_name ?? a.name ?? '').trim();
  const right = (b.display_name ?? b.name ?? '').trim();
  const primary = left.localeCompare(right, undefined, {
    sensitivity: 'base',
  });

  if (primary !== 0) {
    return primary;
  }

  return (a.id ?? '').localeCompare(b.id ?? '', undefined, {
    sensitivity: 'base',
  });
};
