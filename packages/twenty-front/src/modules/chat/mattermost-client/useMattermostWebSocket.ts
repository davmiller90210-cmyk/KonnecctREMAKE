import { useEffect, useRef } from 'react';

import { mattermostWebSocketUrl } from '@/chat/mattermost-client/mattermostBffClient';

type MattermostWsPayload = {
  event?: string;
  data?: { post?: string };
  seq?: number;
};

export const useMattermostWebSocket = (args: {
  baseUrl: string | undefined;
  token: string | undefined;
  onPosted?: (channelId: string, postId: string) => void;
}) => {
  const { baseUrl, token, onPosted } = args;
  const seqRef = useRef(1);
  const onPostedRef = useRef(onPosted);

  onPostedRef.current = onPosted;

  useEffect(() => {
    if (!baseUrl || !token) {
      return;
    }

    const url = mattermostWebSocketUrl(baseUrl);
    const socket = new WebSocket(url);

    socket.onopen = () => {
      seqRef.current = 1;
      socket.send(
        JSON.stringify({
          seq: seqRef.current,
          action: 'authentication_challenge',
          data: { token },
        }),
      );
    };

    socket.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data as string) as MattermostWsPayload;

        if (payload.event === 'posted' && payload.data?.post) {
          const post = JSON.parse(payload.data.post) as {
            channel_id?: string;
            id?: string;
          };

          if (post.channel_id && post.id) {
            onPostedRef.current?.(post.channel_id, post.id);
          }
        }
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      socket.close();
    };
  }, [baseUrl, token]);
};
