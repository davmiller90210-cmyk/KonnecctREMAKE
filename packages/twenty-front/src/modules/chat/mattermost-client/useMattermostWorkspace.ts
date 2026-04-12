import { useCallback, useEffect, useState } from 'react';

import {
  type MattermostChannel,
  type MattermostPost,
  type MattermostPostsPage,
  type MattermostSession,
  type MattermostTeam,
  type MattermostUser,
} from '@/chat/mattermost-client/mattermost-api.types';
import {
  fetchMattermostSession,
  mattermostForwardJson,
  mattermostUploadFile,
} from '@/chat/mattermost-client/mattermostBffClient';
import { userHasMattermostReaction } from '@/chat/mattermost-client/mattermost-post.utils';

export const useMattermostWorkspace = (crmToken: string | undefined) => {
  const [session, setSession] = useState<MattermostSession | null>(null);
  const [channels, setChannels] = useState<MattermostChannel[]>([]);
  const [teams, setTeams] = useState<MattermostTeam[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!crmToken) {
      setSession(null);
      setChannels([]);
      setTeams([]);
      setStatus('idle');
      setErrorMessage(null);
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const s = await fetchMattermostSession(crmToken);
      const ch = await mattermostForwardJson<MattermostChannel[]>(crmToken, {
        path: '/api/v4/users/me/channels',
      });
      const tm = await mattermostForwardJson<MattermostTeam[]>(crmToken, {
        path: '/api/v4/users/me/teams',
      });

      setSession(s);
      setChannels(Array.isArray(ch) ? ch : []);
      setTeams(Array.isArray(tm) ? tm : []);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, [crmToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const fetchPosts = useCallback(
    async (channelId: string): Promise<MattermostPost[]> => {
      if (!crmToken) {
        return [];
      }

      const page = await mattermostForwardJson<MattermostPostsPage>(crmToken, {
        path: `/api/v4/channels/${encodeURIComponent(channelId)}/posts?page=0&per_page=60`,
      });

      const order = page?.order ?? [];
      const byId = page?.posts ?? {};

      return order
        .map((id) => byId[id])
        .filter(Boolean)
        .sort((a, b) => a.create_at - b.create_at);
    },
    [crmToken],
  );

  const createPost = useCallback(
    async (
      channelId: string,
      message: string,
      thread?: { rootId: string; parentId: string },
      fileIds?: string[],
    ) => {
      if (!crmToken) {
        return;
      }

      const trimmed = message.trim();

      if (!trimmed && (!fileIds || fileIds.length === 0)) {
        return;
      }

      const body: Record<string, unknown> = {
        channel_id: channelId,
        message: trimmed,
      };

      if (thread) {
        body.root_id = thread.rootId;
        body.parent_id = thread.parentId;
      }

      if (fileIds?.length) {
        body.file_ids = fileIds;
      }

      await mattermostForwardJson<unknown>(crmToken, {
        method: 'POST',
        path: '/api/v4/posts',
        body,
      });
    },
    [crmToken],
  );

  const uploadMattermostFileToChannel = useCallback(
    async (channelId: string, file: File) => {
      if (!crmToken) {
        throw new Error('Not signed in');
      }

      return mattermostUploadFile(crmToken, channelId, file);
    },
    [crmToken],
  );

  const toggleMattermostReaction = useCallback(
    async (post: MattermostPost, emojiName: string) => {
      if (!crmToken || !session?.mattermostUserId) {
        return;
      }

      const uid = session.mattermostUserId;
      const has = userHasMattermostReaction(post, uid, emojiName);

      if (has) {
        const path = `/api/v4/users/${encodeURIComponent(uid)}/posts/${encodeURIComponent(post.id)}/reactions/${encodeURIComponent(emojiName)}`;

        await mattermostForwardJson<unknown>(crmToken, {
          method: 'DELETE',
          path,
        });
      } else {
        await mattermostForwardJson<unknown>(crmToken, {
          method: 'POST',
          path: '/api/v4/reactions',
          body: {
            user_id: uid,
            post_id: post.id,
            emoji_name: emojiName,
          },
        });
      }
    },
    [crmToken, session?.mattermostUserId],
  );

  const fetchThread = useCallback(
    async (rootPostId: string): Promise<MattermostPost[]> => {
      if (!crmToken) {
        return [];
      }

      const page = await mattermostForwardJson<MattermostPostsPage>(crmToken, {
        path: `/api/v4/posts/${encodeURIComponent(rootPostId)}/thread`,
      });

      const order = page?.order ?? [];
      const byId = page?.posts ?? {};

      return order
        .map((id) => byId[id])
        .filter(Boolean)
        .sort((a, b) => a.create_at - b.create_at);
    },
    [crmToken],
  );

  const fetchUsersByIds = useCallback(
    async (ids: string[]): Promise<Record<string, MattermostUser>> => {
      if (!crmToken || ids.length === 0) {
        return {};
      }

      const unique = [...new Set(ids)].slice(0, 200);
      const query = unique.map((id) => `ids=${encodeURIComponent(id)}`).join('&');
      const users = await mattermostForwardJson<MattermostUser[]>(crmToken, {
        path: `/api/v4/users/ids?${query}`,
      });

      const map: Record<string, MattermostUser> = {};

      if (Array.isArray(users)) {
        for (const u of users) {
          map[u.id] = u;
        }
      }

      return map;
    },
    [crmToken],
  );

  const searchMattermostUsers = useCallback(
    async (
      term: string,
      ctx: { teamId?: string; channelId?: string },
    ): Promise<MattermostUser[]> => {
      if (!crmToken || !term.trim()) {
        return [];
      }

      const params = new URLSearchParams({
        name: term,
        limit: '20',
      });

      if (ctx.channelId) {
        params.set('in_channel', ctx.channelId);
      } else if (ctx.teamId) {
        params.set('in_team', ctx.teamId);
      } else {
        return [];
      }

      const res = await mattermostForwardJson<{
        users?: {
          id: string;
          username: string;
          first_name: string;
          last_name: string;
        }[];
      }>(crmToken, {
        path: `/api/v4/users/autocomplete?${params.toString()}`,
      });

      const raw = res?.users ?? [];

      return raw.map((u) => ({
        id: u.id,
        username: u.username,
        first_name: u.first_name ?? '',
        last_name: u.last_name ?? '',
      }));
    },
    [crmToken],
  );

  return {
    session,
    channels,
    teams,
    status,
    errorMessage,
    reload: load,
    fetchPosts,
    fetchThread,
    createPost,
    uploadMattermostFileToChannel,
    toggleMattermostReaction,
    fetchUsersByIds,
    searchMattermostUsers,
  };
};
