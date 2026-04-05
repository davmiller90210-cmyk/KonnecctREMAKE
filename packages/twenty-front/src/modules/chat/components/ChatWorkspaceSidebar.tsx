import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { styled } from '@linaria/react';
import { formatDistanceToNow } from 'date-fns';
import { t } from '@lingui/core/macro';
import { IconMessageCirclePlus, IconPhone } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { CreateChannelModal } from '@/chat/components/CreateChannelModal';
import { GradientAvatar } from '@/chat/components/GradientAvatar';
import { NewDmModal } from '@/chat/components/NewDmModal';
import { agoraConversationsAtom } from '@/chat/states/agoraSessionState';
import { type ChatWorkspaceLayoutResponse } from '@/chat/types/chat-workspace-layout.type';
import { type ChatWorkspaceMemberOption } from '@/chat/types/chat-workspace-layout.type';

const StyledSidebar = styled.aside<{ $full: boolean }>`
  display: flex;
  flex-direction: column;
  width: ${({ $full }) => ($full ? '100%' : '308px')};
  flex-shrink: 0;
  border-right: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.secondary};
  overflow: hidden;
  height: 100%;
`;

const StyledStoriesScroll = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
  overflow-x: auto;
  flex-shrink: 0;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
`;

const StyledStoryButton = styled.button`
  border: none;
  padding: 0;
  background: none;
  cursor: pointer;
  flex-shrink: 0;
`;

const StyledTopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]} 0;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledTitleBlock = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${themeCssVariables.spacing[2]};
  min-width: 0;
`;

const StyledInboxTitle = styled.span`
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledBadge = styled.span`
  font-size: 11px;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  font-family: ${themeCssVariables.font.family};
  padding: 2px 8px;
  border-radius: ${themeCssVariables.border.radius.pill};
  background: ${themeCssVariables.background.transparent.medium};
  color: ${themeCssVariables.color.blue9};
  flex-shrink: 0;
`;

const StyledSearch = styled.input`
  margin: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]} 0;
  width: calc(100% - ${themeCssVariables.spacing[8]});
  box-sizing: border-box;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  font-size: ${themeCssVariables.font.size.sm};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.primary};
  background: ${themeCssVariables.background.primary};
  outline: none;

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
  }

  &:focus {
    border-color: ${themeCssVariables.color.blue8};
  }
`;

const StyledScroll = styled.div`
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: ${themeCssVariables.spacing[3]} 0 ${themeCssVariables.spacing[4]};
`;

const StyledSectionLabel = styled.div`
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]}
    ${themeCssVariables.spacing[1]};
  font-size: 11px;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
`;

const StyledSectionHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]} 0;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledSectionLabelInline = styled.div`
  font-size: 11px;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
`;

const StyledEmptyHint = styled.div`
  padding: 0 ${themeCssVariables.spacing[4]};
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
`;

const StyledChannelActions = styled.div`
  padding: 0 ${themeCssVariables.spacing[4]} ${themeCssVariables.spacing[2]};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledRow = styled.button<{ $selected: boolean }>`
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  width: calc(100% - ${themeCssVariables.spacing[8]});
  margin: 0 ${themeCssVariables.spacing[4]} ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[2]};
  border: none;
  border-radius: ${themeCssVariables.border.radius.md};
  cursor: pointer;
  text-align: left;
  background: ${({ $selected }) =>
    $selected ? themeCssVariables.background.transparent.medium : 'transparent'};

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledRowMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const StyledRowTitle = styled.span`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledRowPreview = styled.span`
  font-size: 11px;
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.tertiary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledRowRight = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
`;

const StyledRowTime = styled.span`
  font-size: 10px;
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.light};
`;

const StyledUnread = styled.span`
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: ${themeCssVariables.border.radius.pill};
  background: ${themeCssVariables.color.blue9};
  color: ${themeCssVariables.font.color.inverted};
  font-size: 10px;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  font-family: ${themeCssVariables.font.family};
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const StyledStatusMock = styled.span`
  font-size: 10px;
  color: ${themeCssVariables.font.color.tertiary};
`;

type ChatWorkspaceSidebarProps = {
  layout: ChatWorkspaceLayoutResponse | null;
  selectedChannelId: string | null;
  selectedDmThreadId: string | null;
  authToken: string | undefined;
  onLayoutRefresh: () => void;
  members: ChatWorkspaceMemberOption[];
  viewerUserWorkspaceId: string | null;
  fullWidth?: boolean;
  /** Increment to open the new-DM modal (e.g. from chat rail FAB). */
  openDmSignal?: number;
};

type ChannelRowModel = {
  kind: 'channel';
  id: string;
  name: string;
  agoraGroupId: string | null;
  visibility: 'public' | 'private';
};

type DmRowModel = {
  kind: 'dm';
  id: string;
  title: string;
  agoraTarget: string | null;
};

const useAgoraPreview = (agoraId: string | null | undefined) => {
  const conversations = useAtomValue(agoraConversationsAtom);

  return useMemo(() => {
    if (!agoraId) {
      return { unread: 0, preview: '', time: null as number | null };
    }

    const hit = conversations.find((c) => c.id === agoraId);

    if (!hit) {
      return { unread: 0, preview: '', time: null as number | null };
    }

    const preview =
      hit.lastMessage?.type === 'txt'
        ? (hit.lastMessage.text ?? '').slice(0, 80)
        : hit.lastMessage
          ? 'Attachment'
          : '';

    return {
      unread: hit.unreadCount,
      preview,
      time: hit.lastMessage?.createdAt ?? null,
    };
  }, [agoraId, conversations]);
};

const ChannelRow = ({
  channel,
  selected,
  onSelect,
  mockStatus,
}: {
  channel: ChannelRowModel;
  selected: boolean;
  onSelect: () => void;
  mockStatus: 'read' | 'missed' | 'none';
}) => {
  const { unread, preview, time } = useAgoraPreview(channel.agoraGroupId);

  return (
    <StyledRow type="button" $selected={selected} onClick={onSelect}>
      <GradientAvatar label={channel.name} size={36} />
      <StyledRowMain>
        <StyledRowTitle>#{channel.name}</StyledRowTitle>
        <StyledRowPreview>
          {preview || (channel.visibility === 'private' ? t`Private channel` : t`Channel`)}
        </StyledRowPreview>
      </StyledRowMain>
      <StyledRowRight>
        <StyledRowTime>
          {time
            ? formatDistanceToNow(time, { addSuffix: false })
            : ''}
        </StyledRowTime>
        {unread > 0 ? (
          <StyledUnread>{unread > 9 ? '9+' : unread}</StyledUnread>
        ) : mockStatus === 'read' ? (
          <StyledStatusMock>✓✓</StyledStatusMock>
        ) : mockStatus === 'missed' ? (
          <StyledStatusMock title={t`Missed call (preview)`}>📵</StyledStatusMock>
        ) : (
          <StyledStatusMock />
        )}
      </StyledRowRight>
    </StyledRow>
  );
};

const DmRow = ({
  dm,
  selected,
  onSelect,
}: {
  dm: DmRowModel;
  selected: boolean;
  onSelect: () => void;
}) => {
  const { unread, preview, time } = useAgoraPreview(dm.agoraTarget);

  return (
    <StyledRow type="button" $selected={selected} onClick={onSelect}>
      <GradientAvatar label={dm.title} size={36} />
      <StyledRowMain>
        <StyledRowTitle>{dm.title}</StyledRowTitle>
        <StyledRowPreview>
          {preview || t`Direct message`}
        </StyledRowPreview>
      </StyledRowMain>
      <StyledRowRight>
        <StyledRowTime>
          {time ? formatDistanceToNow(time, { addSuffix: false }) : ''}
        </StyledRowTime>
        {unread > 0 ? (
          <StyledUnread>{unread > 9 ? '9+' : unread}</StyledUnread>
        ) : null}
      </StyledRowRight>
    </StyledRow>
  );
};

export const ChatWorkspaceSidebar = ({
  layout,
  selectedChannelId,
  selectedDmThreadId,
  authToken,
  onLayoutRefresh,
  members,
  viewerUserWorkspaceId,
  fullWidth = false,
  openDmSignal = 0,
}: ChatWorkspaceSidebarProps) => {
  const navigate = useNavigate();
  const conversations = useAtomValue(agoraConversationsAtom);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [query, setQuery] = useState('');
  const lastDmSignal = useRef(0);

  useEffect(() => {
    if (openDmSignal > 0 && openDmSignal !== lastDmSignal.current) {
      lastDmSignal.current = openDmSignal;
      setNewDmOpen(true);
    }
  }, [openDmSignal]);

  const totalUnread = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unreadCount ?? 0), 0),
    [conversations],
  );

  const storyMembers = useMemo(
    () =>
      members
        .filter((m) => m.userWorkspaceId !== viewerUserWorkspaceId)
        .slice(0, 12),
    [members, viewerUserWorkspaceId],
  );

  const { pinnedChannel, groupChannels } = useMemo(() => {
    if (!layout) {
      return {
        pinnedChannel: null as ChannelRowModel | null,
        groupChannels: [] as ChannelRowModel[],
      };
    }

    const flat: ChannelRowModel[] = [];

    for (const cat of layout.categories) {
      for (const ch of cat.channels) {
        flat.push({
          kind: 'channel',
          id: ch.id,
          name: ch.name,
          agoraGroupId: ch.agoraGroupId,
          visibility: ch.visibility,
        });
      }
    }

    const pinned = flat[0] ?? null;
    const groups = pinned ? flat.filter((c) => c.id !== pinned.id) : flat;

    return {
      pinnedChannel: pinned,
      groupChannels: groups,
    };
  }, [layout]);

  const dmRows: DmRowModel[] = useMemo(() => {
    if (!layout) {
      return [];
    }

    return layout.directThreads.map((t) => ({
      kind: 'dm' as const,
      id: t.id,
      title: t.title ?? t`Direct`,
      agoraTarget: t.agoraGroupId ?? t.peerAgoraUserId,
    }));
  }, [layout]);

  const q = query.trim().toLowerCase();

  const filterChannel = (c: ChannelRowModel) =>
    !q || c.name.toLowerCase().includes(q);

  const filterDm = (d: DmRowModel) =>
    !q || d.title.toLowerCase().includes(q);

  const openChannel = useCallback(
    (channelId: string) => {
      navigate(`/chat/c/${channelId}`);
    },
    [navigate],
  );

  const openDm = useCallback(
    (threadId: string) => {
      navigate(`/chat/dm/${threadId}`);
    },
    [navigate],
  );

  const handleChannelCreated = useCallback(
    (id: string) => {
      navigate(`/chat/c/${id}`);
    },
    [navigate],
  );

  const handleDmCreated = useCallback(
    (threadId: string) => {
      navigate(`/chat/dm/${threadId}`);
    },
    [navigate],
  );

  const mockStatusAt = (index: number): 'read' | 'missed' | 'none' => {
    if (index % 7 === 3) {
      return 'missed';
    }
    if (index % 5 === 2) {
      return 'read';
    }

    return 'none';
  };

  if (!layout) {
    return (
      <StyledSidebar $full={fullWidth}>
        <StyledScroll />
      </StyledSidebar>
    );
  }

  return (
    <StyledSidebar $full={fullWidth}>
      <CreateChannelModal
        isOpen={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        token={authToken}
        layout={layout}
        onCreated={handleChannelCreated}
        onLayoutRefresh={onLayoutRefresh}
      />
      <NewDmModal
        isOpen={newDmOpen}
        onClose={() => setNewDmOpen(false)}
        token={authToken}
        onCreated={handleDmCreated}
        onLayoutRefresh={onLayoutRefresh}
      />

      <StyledStoriesScroll>
        {storyMembers.map((m) => (
          <StyledStoryButton
            key={m.userWorkspaceId}
            type="button"
            title={t`New message`}
            onClick={() => setNewDmOpen(true)}
          >
            <GradientAvatar
              label={`${m.firstName} ${m.lastName}`.trim() || m.email}
              size={44}
            />
          </StyledStoryButton>
        ))}
      </StyledStoriesScroll>

      <StyledTopBar>
        <StyledTitleBlock>
          <StyledInboxTitle>{t`Messages`}</StyledInboxTitle>
          {totalUnread > 0 ? (
            <StyledBadge>
              {totalUnread > 99 ? '99+' : totalUnread} {t`new`}
            </StyledBadge>
          ) : null}
        </StyledTitleBlock>
        <Button
          size="small"
          variant="secondary"
          Icon={IconMessageCirclePlus}
          title={t`Compose`}
          ariaLabel={t`Compose`}
          onClick={() => setNewDmOpen(true)}
        />
      </StyledTopBar>

      <StyledSearch
        type="search"
        placeholder={t`Search name…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t`Search conversations`}
      />

      <StyledScroll>
        {pinnedChannel && filterChannel(pinnedChannel) && (
          <>
            <StyledSectionLabel>{t`Pinned chat`}</StyledSectionLabel>
            <ChannelRow
              channel={pinnedChannel}
              selected={pinnedChannel.id === selectedChannelId}
              onSelect={() => openChannel(pinnedChannel.id)}
              mockStatus={mockStatusAt(0)}
            />
          </>
        )}

        <StyledSectionHeaderRow>
          <StyledSectionLabelInline>{t`Group chats`}</StyledSectionLabelInline>
          <Button
            size="small"
            variant="secondary"
            title={t`New channel`}
            onClick={() => setCreateChannelOpen(true)}
          />
        </StyledSectionHeaderRow>
        <StyledChannelActions>
          <Button
            size="small"
            variant="tertiary"
            Icon={IconPhone}
            title={t`Call (preview)`}
            onClick={() => {}}
          />
        </StyledChannelActions>
        {groupChannels.filter(filterChannel).length === 0 ? (
          <StyledEmptyHint>{t`No channels match filter`}</StyledEmptyHint>
        ) : (
          groupChannels.filter(filterChannel).map((ch, i) => (
            <ChannelRow
              key={ch.id}
              channel={ch}
              selected={ch.id === selectedChannelId}
              onSelect={() => openChannel(ch.id)}
              mockStatus={mockStatusAt(i + 1)}
            />
          ))
        )}

        <StyledSectionLabel>{t`All messages`}</StyledSectionLabel>
        {dmRows.filter(filterDm).length === 0 ? (
          <StyledEmptyHint>{t`No direct messages yet`}</StyledEmptyHint>
        ) : (
          dmRows.filter(filterDm).map((dm) => (
            <DmRow
              key={dm.id}
              dm={dm}
              selected={dm.id === selectedDmThreadId}
              onSelect={() => openDm(dm.id)}
            />
          ))
        )}
      </StyledScroll>
    </StyledSidebar>
  );
};
