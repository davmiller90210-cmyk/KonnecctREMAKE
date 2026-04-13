import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { styled } from '@linaria/react';
import { AppPath } from 'twenty-shared/types';
import { getAppPath } from 'twenty-shared/utils';
import {
  Callout,
  IconArrowLeft,
  IconPaperclip,
  IconPhone,
  IconSend,
  IconX,
} from 'twenty-ui/display';
import { Button, IconButton, LightIconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { useMattermostCallShellOptional } from '@/chat/contexts/MattermostCallShellContext';
import { MattermostPostMessageBody } from '@/chat/components/MattermostPostMessageBody';
import {
  type MattermostChannel,
  type MattermostPost,
} from '@/chat/mattermost-client/mattermost-api.types';
import { MATTERMOST_QUICK_REACTIONS } from '@/chat/constants/mattermost.constants';
import {
  compareMattermostChannels,
  formatMattermostRelativeTime,
} from '@/chat/mattermost-client/mattermost-format.utils';
import {
  getMattermostReactions,
  userHasMattermostReaction,
} from '@/chat/mattermost-client/mattermost-post.utils';
import { useMattermostWebSocket } from '@/chat/mattermost-client/useMattermostWebSocket';
import { useMattermostWorkspace } from '@/chat/mattermost-client/useMattermostWorkspace';
import { useMattermostRecordMentionSearch } from '@/chat/hooks/useMattermostRecordMentionSearch';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

const StyledRoot = styled.div`
  background: ${themeCssVariables.background.noisy};
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  width: 100%;
`;

const StyledShell = styled.div`
  background: ${themeCssVariables.background.primary};
  display: flex;
  flex: 1 1 auto;
  flex-direction: row;
  min-height: 0;
  min-width: 0;
  width: 100%;
`;

const StyledPrimaryColumn = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
`;

const StyledSidebar = styled.aside`
  border-right: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
  width: 280px;
`;

const StyledSidebarHeader = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  flex-shrink: 0;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledChannelList = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
`;

const StyledChannelRow = styled.button<{ $active?: boolean }>`
  background: ${({ $active }) =>
    $active
      ? themeCssVariables.background.transparent.secondary
      : 'transparent'};
  border: none;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: block;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  text-align: left;
  width: 100%;

  &:hover {
    background: ${themeCssVariables.background.transparent.secondary};
  }
`;

const StyledSidebarSectionLabel = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]}
    ${themeCssVariables.spacing[1]};
  text-transform: uppercase;
`;

const StyledThreadPanel = styled.aside`
  border-left: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  width: min(380px, 42vw);
`;

const StyledThreadHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  min-height: 48px;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledThreadTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: 600;
`;

const StyledThreadPosts = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledPostCard = styled.button`
  background: transparent;
  border: none;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: inherit;
  cursor: pointer;
  display: block;
  margin-bottom: ${themeCssVariables.spacing[3]};
  padding: 0 0 ${themeCssVariables.spacing[3]} 0;
  text-align: left;
  width: 100%;

  &:hover {
    opacity: 0.92;
  }
`;

const StyledReplyHint = styled.span`
  color: ${themeCssVariables.color.blue};
  display: inline-block;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: 500;
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledReactionStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  margin-top: ${themeCssVariables.spacing[2]};
`;

const StyledReactionPill = styled.button<{ $active: boolean }>`
  align-items: center;
  background: ${({ $active }) =>
    $active
      ? themeCssVariables.background.transparent.blue
      : themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.xs};
  gap: 4px;
  padding: 2px ${themeCssVariables.spacing[2]};

  &:hover {
    border-color: ${themeCssVariables.border.color.medium};
  }
`;

const StyledFileHint = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  display: block;
  font-size: ${themeCssVariables.font.size.xs};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledPendingFiles = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

const StyledHiddenFileInput = styled.input`
  display: none;
`;

const StyledHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  min-height: 48px;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledHeaderLeft = styled.div`
  align-items: center;
  display: flex;
  gap: 12px;
  min-width: 0;
`;

const StyledRetryWrap = styled.div`
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: 600;
`;

const StyledPosts = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledThreadPostBlock = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  margin-bottom: ${themeCssVariables.spacing[3]};
  padding-bottom: ${themeCssVariables.spacing[3]};
`;

const StyledThreadComposer = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  flex-shrink: 0;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledMeta = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledComposerWrap = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  flex-shrink: 0;
  padding: ${themeCssVariables.spacing[3]};
  position: relative;
`;

const StyledComposerRow = styled.div`
  align-items: flex-end;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledComposerTextarea = styled.textarea`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  flex: 1 1 auto;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.4;
  max-height: 200px;
  min-height: 72px;
  min-width: 0;
  outline: none;
  padding: ${themeCssVariables.spacing[2]};
  resize: vertical;
  width: 100%;

  &::placeholder {
    color: ${themeCssVariables.font.color.tertiary};
  }
`;

const StyledMentionList = styled.ul`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  bottom: 100%;
  box-shadow: ${themeCssVariables.boxShadow.strong};
  left: ${themeCssVariables.spacing[3]};
  list-style: none;
  margin: 0 0 ${themeCssVariables.spacing[2]} 0;
  max-height: 220px;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[1]} 0;
  position: absolute;
  right: ${themeCssVariables.spacing[3]};
  z-index: 5;
`;

const StyledMentionItem = styled.li`
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};

  &:hover {
    background: ${themeCssVariables.background.transparent.secondary};
  }
`;

const StyledBackLink = styled(Link)`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  text-decoration: none;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }
`;

type MentionPick =
  | {
      kind: 'crm';
      label: string;
      href: string;
    }
  | {
      kind: 'mm';
      username: string;
    };

const MattermostHubErrorFallback = ({
  error,
  resetErrorBoundary,
}: FallbackProps) => (
  <StyledRoot>
    <Callout
      variant="warning"
      title="Chat failed to load"
      description={error instanceof Error ? error.message : String(error)}
    />
    <StyledRetryWrap>
      <Button
        title="Retry"
        variant="secondary"
        onClick={resetErrorBoundary}
      />
    </StyledRetryWrap>
  </StyledRoot>
);

const MattermostHubImpl = () => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const crmToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const navigate = useNavigate();
  const { channelId: routeChannelId } = useParams<{ channelId?: string }>();
  const callShell = useMattermostCallShellOptional();
  const { searchMentionRecords } = useMattermostRecordMentionSearch();

  const {
    session,
    channels,
    teams,
    status,
    errorMessage,
    reload,
    fetchPosts,
    fetchThread,
    createPost,
    uploadMattermostFileToChannel,
    toggleMattermostReaction,
    fetchUsersByIds,
    searchMattermostUsers,
  } = useMattermostWorkspace(crmToken);

  const [posts, setPosts] = useState<MattermostPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [userMap, setUserMap] = useState<
    Record<string, { username: string; first_name: string; last_name: string }>
  >({});
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionItems, setMentionItems] = useState<MentionPick[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const threadFileInputRef = useRef<HTMLInputElement>(null);
  const threadRootIdRef = useRef<string | null>(null);

  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const [threadPosts, setThreadPosts] = useState<MattermostPost[]>([]);
  const [threadDraft, setThreadDraft] = useState('');
  const [threadSending, setThreadSending] = useState(false);
  const [pendingFileIds, setPendingFileIds] = useState<string[]>([]);
  const [pendingThreadFileIds, setPendingThreadFileIds] = useState<string[]>(
    [],
  );
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const sortedChannels = useMemo(() => {
    const list = [...channels];

    return list.sort(compareMattermostChannels);
  }, [channels]);

  const publicChannels = useMemo(
    () => sortedChannels.filter((c) => c.type === 'O' || c.type === 'P'),
    [sortedChannels],
  );

  const directChannels = useMemo(
    () => sortedChannels.filter((c) => c.type === 'D' || c.type === 'G'),
    [sortedChannels],
  );

  const defaultChannelId = useMemo(
    () =>
      publicChannels[0]?.id ??
      directChannels[0]?.id ??
      sortedChannels[0]?.id,
    [publicChannels, directChannels, sortedChannels],
  );

  const activeChannel = useMemo(() => {
    if (!routeChannelId) {
      return undefined;
    }

    return sortedChannels.find((c) => c.id === routeChannelId);
  }, [routeChannelId, sortedChannels]);

  const rootPosts = useMemo(
    () => posts.filter((p) => !p.root_id),
    [posts],
  );

  const teamForChannel = useMemo(() => {
    if (!activeChannel) {
      return undefined;
    }

    return teams.find((t) => t.id === activeChannel.team_id);
  }, [activeChannel, teams]);

  useEffect(() => {
    if (status !== 'ready' || sortedChannels.length === 0 || !defaultChannelId) {
      return;
    }

    if (!routeChannelId) {
      navigate(`/chat/c/${defaultChannelId}`, { replace: true });
      return;
    }

    if (!sortedChannels.some((c) => c.id === routeChannelId)) {
      navigate(`/chat/c/${defaultChannelId}`, { replace: true });
    }
  }, [status, sortedChannels, routeChannelId, navigate, defaultChannelId]);

  useEffect(() => {
    threadRootIdRef.current = threadRootId;
  }, [threadRootId]);

  useEffect(() => {
    setThreadRootId(null);
    setThreadPosts([]);
    setThreadDraft('');
    setPendingFileIds([]);
    setPendingThreadFileIds([]);
  }, [activeChannel?.id]);

  useEffect(() => {
    if (!threadRootId || !crmToken) {
      setThreadPosts([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const list = await fetchThread(threadRootId);

        if (!cancelled) {
          setThreadPosts(list);
        }

        const ids = [...new Set(list.map((p) => p.user_id))];
        const map = await fetchUsersByIds(ids);

        if (!cancelled) {
          setUserMap((prev) => ({ ...prev, ...map }));
        }
      } catch {
        if (!cancelled) {
          setThreadPosts([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [threadRootId, crmToken, fetchThread, fetchUsersByIds]);

  const loadPosts = useCallback(async () => {
    if (!activeChannel || !crmToken) {
      setPosts([]);
      return;
    }

    setPostsLoading(true);

    try {
      const list = await fetchPosts(activeChannel.id);
      setPosts(list);

      const ids = [...new Set(list.map((p) => p.user_id))];
      const map = await fetchUsersByIds(ids);
      setUserMap(map);
    } catch {
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [activeChannel, crmToken, fetchPosts, fetchUsersByIds]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const appendPostFromWs = useCallback(
    async (channelId: string) => {
      if (channelId !== activeChannel?.id) {
        return;
      }

      await loadPosts();
      const rootId = threadRootIdRef.current;

      if (rootId) {
        try {
          const list = await fetchThread(rootId);
          setThreadPosts(list);
        } catch {
          // ignore thread refresh errors
        }
      }
    },
    [activeChannel?.id, fetchThread, loadPosts],
  );

  useMattermostWebSocket({
    baseUrl: session?.baseUrl,
    token: session?.token,
    onPosted: (channelId) => {
      void appendPostFromWs(channelId);
    },
  });

  const labelForUser = useCallback(
    (userId: string | undefined) => {
      const id = userId ?? '';

      const u = id ? userMap[id] : undefined;

      if (!u) {
        return id ? id.slice(0, 8) : '—';
      }

      const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();

      return name || u.username || id.slice(0, 8);
    },
    [userMap],
  );

  const onSelectChannel = useCallback(
    (ch: MattermostChannel) => {
      navigate(`/chat/c/${ch.id}`);
    },
    [navigate],
  );

  const openThread = useCallback((rootPostId: string) => {
    setThreadRootId(rootPostId);
  }, []);

  const closeThread = useCallback(() => {
    setThreadRootId(null);
    setThreadPosts([]);
    setThreadDraft('');
  }, []);

  const sendThreadReply = useCallback(async () => {
    const text = threadDraft.trim();

    if (
      (!text && pendingThreadFileIds.length === 0) ||
      !activeChannel ||
      !threadRootId ||
      !crmToken
    ) {
      return;
    }

    const parentId =
      threadPosts.length > 0
        ? threadPosts[threadPosts.length - 1].id
        : threadRootId;

    setThreadSending(true);

    try {
      await createPost(
        activeChannel.id,
        text,
        {
          rootId: threadRootId,
          parentId,
        },
        pendingThreadFileIds.length > 0 ? pendingThreadFileIds : undefined,
      );
      setThreadDraft('');
      setPendingThreadFileIds([]);
      const list = await fetchThread(threadRootId);
      setThreadPosts(list);
      await loadPosts();
    } finally {
      setThreadSending(false);
    }
  }, [
    activeChannel,
    createPost,
    crmToken,
    fetchThread,
    loadPosts,
    pendingThreadFileIds,
    threadDraft,
    threadPosts,
    threadRootId,
  ]);

  const handleMainFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      event.target.value = '';

      if (!file || !activeChannel) {
        return;
      }

      setUploadingAttachment(true);

      try {
        const res = await uploadMattermostFileToChannel(activeChannel.id, file);
        const id = res.file_infos?.[0]?.id;

        if (id) {
          setPendingFileIds((prev) => [...prev, id]);
        }
      } catch {
        // ignore; could surface toast later
      } finally {
        setUploadingAttachment(false);
      }
    },
    [activeChannel, uploadMattermostFileToChannel],
  );

  const handleThreadFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      event.target.value = '';

      if (!file || !activeChannel) {
        return;
      }

      setUploadingAttachment(true);

      try {
        const res = await uploadMattermostFileToChannel(activeChannel.id, file);
        const id = res.file_infos?.[0]?.id;

        if (id) {
          setPendingThreadFileIds((prev) => [...prev, id]);
        }
      } catch {
        // ignore
      } finally {
        setUploadingAttachment(false);
      }
    },
    [activeChannel, uploadMattermostFileToChannel],
  );

  const refreshMentionItems = useCallback(
    async (q: string) => {
      const teamId = teamForChannel?.id ?? teams[0]?.id;

      const items: MentionPick[] = [];

      if (q.length > 0) {
        const mmUsers = await searchMattermostUsers(q, {
          channelId: activeChannel?.id,
          teamId,
        });

        for (const u of mmUsers) {
          items.push({ kind: 'mm', username: u.username });
        }
      }

      if (q.length > 0) {
        const records = await searchMentionRecords(q);

        const origin =
          typeof window !== 'undefined' ? window.location.origin : '';

        for (const r of records) {
          if (r.mentionType !== 'record') {
            continue;
          }

          const path = getAppPath(AppPath.RecordShowPage, {
            objectNameSingular: r.objectNameSingular,
            objectRecordId: r.recordId,
          });

          items.push({
            kind: 'crm',
            label: r.label,
            href: `${origin}${path}`,
          });
        }
      }

      setMentionItems(items.slice(0, 25));
      setMentionIndex(0);
    },
    [
      searchMattermostUsers,
      searchMentionRecords,
      teamForChannel?.id,
      teams,
      activeChannel?.id,
    ],
  );

  useEffect(() => {
    if (!mentionOpen) {
      return;
    }

    if (mentionDebounceRef.current) {
      clearTimeout(mentionDebounceRef.current);
    }

    mentionDebounceRef.current = setTimeout(() => {
      void refreshMentionItems(mentionQuery);
    }, 200);

    return () => {
      if (mentionDebounceRef.current) {
        clearTimeout(mentionDebounceRef.current);
      }
    };
  }, [mentionOpen, mentionQuery, refreshMentionItems]);

  const applyMentionPick = useCallback(
    (pick: MentionPick) => {
      if (mentionStart === null) {
        return;
      }

      const before = draft.slice(0, mentionStart);
      const after = draft.slice(mentionStart + 1 + mentionQuery.length);
      const insert =
        pick.kind === 'crm'
          ? `[@${pick.label}](${pick.href})`
          : `@${pick.username} `;

      setDraft(`${before}${insert}${after}`);
      setMentionOpen(false);
      setMentionQuery('');
      setMentionStart(null);
    },
    [draft, mentionQuery, mentionStart],
  );

  const refreshAfterReaction = useCallback(async () => {
    await loadPosts();
    const rootId = threadRootIdRef.current;

    if (rootId) {
      try {
        const list = await fetchThread(rootId);
        setThreadPosts(list);
      } catch {
        // ignore
      }
    }
  }, [fetchThread, loadPosts]);

  const handleReactionToggle = useCallback(
    async (post: MattermostPost, emojiName: string) => {
      await toggleMattermostReaction(post, emojiName);
      await refreshAfterReaction();
    },
    [refreshAfterReaction, toggleMattermostReaction],
  );

  const sendMessage = useCallback(async () => {
    const text = draft.trim();

    if (
      (!text && pendingFileIds.length === 0) ||
      !activeChannel ||
      !crmToken
    ) {
      return;
    }

    setSending(true);

    try {
      await createPost(
        activeChannel.id,
        text,
        undefined,
        pendingFileIds.length > 0 ? pendingFileIds : undefined,
      );
      setDraft('');
      setPendingFileIds([]);
      setMentionOpen(false);
      await loadPosts();
    } finally {
      setSending(false);
    }
  }, [
    activeChannel,
    createPost,
    crmToken,
    draft,
    loadPosts,
    pendingFileIds,
  ]);

  const onComposerKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionOpen && mentionItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setMentionIndex((i) => (i + 1) % mentionItems.length);
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setMentionIndex(
            (i) => (i - 1 + mentionItems.length) % mentionItems.length,
          );
          return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          applyMentionPick(mentionItems[mentionIndex]);
          return;
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          setMentionOpen(false);
          return;
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void sendMessage();
      }
    },
    [
      applyMentionPick,
      mentionIndex,
      mentionItems,
      mentionOpen,
      sendMessage,
    ],
  );

  const onComposerInput = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      const cursor =
        typeof event.target.selectionStart === 'number'
          ? event.target.selectionStart
          : value.length;

      setDraft(value);
      const beforeCursor = value.slice(0, cursor);
      const at = beforeCursor.lastIndexOf('@');

      if (at >= 0) {
        const afterAt = beforeCursor.slice(at + 1);
        const invalid = /[\s\n]/.test(afterAt);

        if (!invalid) {
          setMentionOpen(true);
          setMentionStart(at);
          setMentionQuery(afterAt);
          return;
        }
      }

      setMentionOpen(false);
      setMentionQuery('');
      setMentionStart(null);
    },
    [],
  );

  const openCalls = useCallback(() => {
    if (!session || !activeChannel || !teamForChannel) {
      return;
    }

    callShell?.openCallShell({
      baseUrl: session.baseUrl,
      teamName: teamForChannel.name,
      channelName: activeChannel.name,
    });
  }, [activeChannel, callShell, session, teamForChannel]);

  if (!crmToken) {
    return (
      <StyledRoot>
        <Callout
          variant="warning"
          title="Sign in required"
          description="Open a workspace session to use Mattermost chat."
        />
      </StyledRoot>
    );
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <StyledRoot>
        <Callout variant="info" title="Connecting to Mattermost…" />
      </StyledRoot>
    );
  }

  if (status === 'error') {
    return (
      <StyledRoot>
        <Callout
          variant="warning"
          title="Could not load chat"
          description={
            errorMessage ??
            'Something went wrong. You can try again, or contact your workspace administrator if it keeps happening.'
          }
        />
        <StyledRetryWrap>
          <Button title="Retry" variant="secondary" onClick={() => void reload()} />
        </StyledRetryWrap>
      </StyledRoot>
    );
  }

  return (
    <StyledRoot>
      <StyledShell>
        <StyledSidebar>
          <StyledSidebarHeader>
            <StyledTitle>Chat</StyledTitle>
          </StyledSidebarHeader>
          <StyledChannelList>
            {publicChannels.length > 0 ? (
              <>
                <StyledSidebarSectionLabel>
                  Channels
                </StyledSidebarSectionLabel>
                {publicChannels.map((ch) => (
                  <StyledChannelRow
                    key={ch.id}
                    type="button"
                    $active={ch.id === activeChannel?.id}
                    onClick={() => onSelectChannel(ch)}
                  >
                    {ch.display_name || ch.name}
                  </StyledChannelRow>
                ))}
              </>
            ) : null}
            {directChannels.length > 0 ? (
              <>
                <StyledSidebarSectionLabel>
                  Direct messages
                </StyledSidebarSectionLabel>
                {directChannels.map((ch) => (
                  <StyledChannelRow
                    key={ch.id}
                    type="button"
                    $active={ch.id === activeChannel?.id}
                    onClick={() => onSelectChannel(ch)}
                  >
                    {ch.display_name || ch.name}
                  </StyledChannelRow>
                ))}
              </>
            ) : null}
          </StyledChannelList>
        </StyledSidebar>
        <StyledPrimaryColumn>
          <StyledHeader>
            <StyledHeaderLeft>
              <StyledBackLink to={AppPath.Index} title="Back to workspace">
                <IconArrowLeft size={16} />
                Workspace
              </StyledBackLink>
              <StyledTitle>
                {activeChannel?.display_name ?? 'Mattermost'}
              </StyledTitle>
            </StyledHeaderLeft>
            <Button
              Icon={IconPhone}
              title="Calls (Mattermost)"
              variant="secondary"
              size="small"
              onClick={openCalls}
              disabled={!session || !activeChannel || !teamForChannel}
            />
          </StyledHeader>
          <StyledPosts>
            {postsLoading ? (
              <StyledMeta>Loading messages…</StyledMeta>
            ) : null}
            {rootPosts.map((p) => (
              <StyledPostCard
                key={p.id}
                type="button"
                onClick={() => openThread(p.id)}
              >
                <StyledMeta>
                  {labelForUser(p.user_id)} ·{' '}
                  {formatMattermostRelativeTime(p.create_at)}
                </StyledMeta>
                <div>
                  <MattermostPostMessageBody message={p.message} />
                </div>
                {(p.file_ids?.length ?? 0) > 0 ? (
                  <StyledFileHint>
                    {p.file_ids?.length}{' '}
                    {p.file_ids?.length === 1 ? 'attachment' : 'attachments'}
                  </StyledFileHint>
                ) : null}
                {session?.mattermostUserId ? (
                  <StyledReactionStrip
                    role="toolbar"
                    aria-label="Reactions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {MATTERMOST_QUICK_REACTIONS.map(({ label, name }) => {
                      const reactions = getMattermostReactions(p);
                      const count = reactions.filter(
                        (r) => r.emoji_name === name,
                      ).length;
                      const active = userHasMattermostReaction(
                        p,
                        session.mattermostUserId,
                        name,
                      );

                      return (
                        <StyledReactionPill
                          key={name}
                          type="button"
                          $active={active}
                          onClick={() => void handleReactionToggle(p, name)}
                        >
                          <span>{label}</span>
                          {count > 0 ? <span>{count}</span> : null}
                        </StyledReactionPill>
                      );
                    })}
                  </StyledReactionStrip>
                ) : null}
                {(p.reply_count ?? 0) > 0 ? (
                  <StyledReplyHint>
                    {p.reply_count}{' '}
                    {p.reply_count === 1 ? 'reply' : 'replies'} — view thread
                  </StyledReplyHint>
                ) : null}
              </StyledPostCard>
            ))}
          </StyledPosts>
          <StyledComposerWrap>
            <StyledHiddenFileInput
              ref={mainFileInputRef}
              aria-label="Choose file to attach"
              tabIndex={-1}
              type="file"
              onChange={handleMainFileChange}
            />
            {mentionOpen && mentionItems.length > 0 ? (
              <StyledMentionList role="listbox">
                {mentionItems.map((item, idx) => (
                  <StyledMentionItem
                    key={`${item.kind}-${item.kind === 'crm' ? item.href : item.username}`}
                    role="option"
                    aria-selected={idx === mentionIndex}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyMentionPick(item);
                    }}
                  >
                    {item.kind === 'crm'
                      ? `Record: ${item.label}`
                      : `User: @${item.username}`}
                  </StyledMentionItem>
                ))}
              </StyledMentionList>
            ) : null}
            {pendingFileIds.length > 0 ? (
              <StyledPendingFiles>
                {pendingFileIds.length} file
                {pendingFileIds.length === 1 ? '' : 's'} will be attached
              </StyledPendingFiles>
            ) : null}
            <StyledComposerRow>
              <LightIconButton
                Icon={IconPaperclip}
                accent="tertiary"
                aria-label="Attach file"
                title="Attach file"
                disabled={uploadingAttachment || !activeChannel}
                onClick={() => mainFileInputRef.current?.click()}
              />
              <StyledComposerTextarea
                placeholder="Message… (@ for people & CRM records)"
                value={draft}
                onChange={onComposerInput}
                onKeyDown={onComposerKeyDown}
              />
              <Button
                Icon={IconSend}
                title="Send"
                variant="primary"
                size="small"
                disabled={
                  sending ||
                  (!draft.trim() && pendingFileIds.length === 0) ||
                  !activeChannel
                }
                onClick={() => void sendMessage()}
              />
            </StyledComposerRow>
          </StyledComposerWrap>
        </StyledPrimaryColumn>
        {threadRootId ? (
          <StyledThreadPanel>
            <StyledThreadHeader>
              <StyledThreadTitle>Thread</StyledThreadTitle>
              <IconButton
                Icon={IconX}
                variant="tertiary"
                size="small"
                ariaLabel="Close thread"
                title="Close thread"
                onClick={closeThread}
              />
            </StyledThreadHeader>
            <StyledThreadPosts>
              {threadPosts.map((p) => (
                <StyledThreadPostBlock key={p.id}>
                  <StyledMeta>
                    {labelForUser(p.user_id)} ·{' '}
                    {formatMattermostRelativeTime(p.create_at)}
                  </StyledMeta>
                  <div>
                    <MattermostPostMessageBody message={p.message} />
                  </div>
                  {(p.file_ids?.length ?? 0) > 0 ? (
                    <StyledFileHint>
                      {p.file_ids?.length}{' '}
                      {p.file_ids?.length === 1 ? 'attachment' : 'attachments'}
                    </StyledFileHint>
                  ) : null}
                  {session?.mattermostUserId ? (
                    <StyledReactionStrip
                      role="toolbar"
                      aria-label="Reactions"
                    >
                      {MATTERMOST_QUICK_REACTIONS.map(({ label, name }) => {
                        const reactions = getMattermostReactions(p);
                        const count = reactions.filter(
                          (r) => r.emoji_name === name,
                        ).length;
                        const active = userHasMattermostReaction(
                          p,
                          session.mattermostUserId,
                          name,
                        );

                        return (
                          <StyledReactionPill
                            key={name}
                            type="button"
                            $active={active}
                            onClick={() => void handleReactionToggle(p, name)}
                          >
                            <span>{label}</span>
                            {count > 0 ? <span>{count}</span> : null}
                          </StyledReactionPill>
                        );
                      })}
                    </StyledReactionStrip>
                  ) : null}
                </StyledThreadPostBlock>
              ))}
            </StyledThreadPosts>
            <StyledThreadComposer>
              <StyledHiddenFileInput
                ref={threadFileInputRef}
                aria-label="Choose file to attach to thread"
                tabIndex={-1}
                type="file"
                onChange={handleThreadFileChange}
              />
              {pendingThreadFileIds.length > 0 ? (
                <StyledPendingFiles>
                  {pendingThreadFileIds.length} file
                  {pendingThreadFileIds.length === 1 ? '' : 's'} will be attached
                </StyledPendingFiles>
              ) : null}
              <StyledComposerRow>
                <LightIconButton
                  Icon={IconPaperclip}
                  accent="tertiary"
                  aria-label="Attach file to thread"
                  title="Attach file"
                  disabled={uploadingAttachment || !activeChannel}
                  onClick={() => threadFileInputRef.current?.click()}
                />
                <StyledComposerTextarea
                  placeholder="Reply in thread…"
                  value={threadDraft}
                  onChange={(e) => setThreadDraft(e.target.value)}
                  onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendThreadReply();
                    }
                  }}
                />
                <Button
                  Icon={IconSend}
                  title="Reply"
                  variant="primary"
                  size="small"
                  disabled={
                    threadSending ||
                    (!threadDraft.trim() &&
                      pendingThreadFileIds.length === 0) ||
                    !activeChannel
                  }
                  onClick={() => void sendThreadReply()}
                />
              </StyledComposerRow>
            </StyledThreadComposer>
          </StyledThreadPanel>
        ) : null}
      </StyledShell>
    </StyledRoot>
  );
};

export const MattermostHub = () => (
  <ErrorBoundary FallbackComponent={MattermostHubErrorFallback}>
    <MattermostHubImpl />
  </ErrorBoundary>
);
