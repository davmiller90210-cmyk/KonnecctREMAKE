import { type MattermostSession } from '@/chat/mattermost-client/mattermost-api.types';

export async function fetchMattermostSession(
  crmToken: string,
): Promise<MattermostSession> {
  const res = await fetch('/chat/mattermost/session', {
    headers: { Authorization: `Bearer ${crmToken}` },
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return (await res.json()) as MattermostSession;
}

export async function mattermostForwardJson<T>(
  crmToken: string,
  opts: { method?: string; path: string; body?: unknown },
): Promise<T> {
  const res = await fetch('/chat/mattermost/forward', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${crmToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method: opts.method ?? 'GET',
      path: opts.path,
      body: opts.body,
    }),
  });

  const text = await res.text();
  let data: unknown = null;

  if (text.length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!res.ok) {
        throw new Error(text || `Mattermost proxy HTTP ${res.status}`);
      }

      throw new Error('Invalid JSON from Mattermost proxy');
    }
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof (data as { message: unknown }).message === 'string'
        ? (data as { message: string }).message
        : text;

    throw new Error(msg || `Mattermost proxy HTTP ${res.status}`);
  }

  return data as T;
}

export type MattermostFileUploadResponse = {
  file_infos?: { id: string }[];
};

export async function mattermostUploadFile(
  crmToken: string,
  channelId: string,
  file: File,
): Promise<MattermostFileUploadResponse> {
  const formData = new FormData();

  formData.append('channel_id', channelId);
  formData.append('files', file);

  const res = await fetch('/chat/mattermost/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${crmToken}` },
    body: formData,
  });

  const text = await res.text();
  let data: unknown = null;

  if (text.length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(text || `Mattermost upload HTTP ${res.status}`);
    }
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof (data as { message: unknown }).message === 'string'
        ? (data as { message: string }).message
        : text;

    throw new Error(msg || `Mattermost upload HTTP ${res.status}`);
  }

  return (data ?? {}) as MattermostFileUploadResponse;
}

export function mattermostWebSocketUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '');

  if (trimmed.startsWith('https://')) {
    return `wss://${trimmed.slice('https://'.length)}/api/v4/websocket`;
  }

  if (trimmed.startsWith('http://')) {
    return `ws://${trimmed.slice('http://'.length)}/api/v4/websocket`;
  }

  return `${trimmed}/api/v4/websocket`;
}
