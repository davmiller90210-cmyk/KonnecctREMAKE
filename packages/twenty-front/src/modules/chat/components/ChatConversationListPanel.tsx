import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { useAtomValue } from 'jotai';
import { useCallback, useMemo, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { CreateChannelModal } from '@/chat/components/CreateChannelModal';
import { NewDmModal } from '@/chat/components/NewDmModal';
import { useChatWorkspaceLayout } from '@/chat/hooks/useChatWorkspaceLayout';
import { ChatConversationRow } from '@/chat/ui/sidebar/ChatConversationRow';
import { ChatSearchField } from '@/chat/ui/sidebar/ChatSearchField';
import { ChatSidebarFrame } from '@/chat/ui/sidebar/ChatSidebarFrame';
import { ChatSidebarSection } from '@/chat/ui/sidebar/ChatSidebarSection';
import { ChatSidebarSectionLabel } from '@/chat/ui/sidebar/ChatSidebarSectionLabel';
import {
  IconLock,
  IconMessage,
  IconPlus,
  IconUsers,
  IconX,
} from 'twenty-ui/display';
import { Button, LightIconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 0 ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledFooterActions = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledErrorText = styled.div`
  color: ${themeCssVariables.color.red};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[3]};
`;

const StyledEmptyHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[3]};
`;

const CHAT_SIDEBAR_COLLAPSED_KEY = 'twenty-chat-sidebar-collapsed-sections';

const readCollapsedSectionIds = (): Set<string> => {
  if (typeof window === 'undefined') {
    return new Set();
  }
  try {
    const raw = localStorage.getItem(CHAT_SIDEBAR_COLLAPSED_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
};

const DM_SECTION_COLLAPSE_ID = '__dm__';

type ChatConversationListPanelProps = {
  onMobileNavigate?: () => void;
};

export const ChatConversationListPanel = ({
  onMobileNavigate,
}: ChatConversationListPanelProps) => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { layout, error, reload } = useChatWorkspaceLayout();
  const tokenPair = useAtomValue(tokenPairState.atom);
  const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  const channelMatch = useMatch('/chat/c/:channelId');
  const dmMatch = useMatch('/chat/dm/:dmThreadId');
  const activeChannelId = channelMatch?.params.channelId ?? null;
  const activeDmId = dmMatch?.params.dmThreadId ?? null;

  const [search, setSearch] = useState('');
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isNewDmOpen, setIsNewDmOpen] = useState(false);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState(
    readCollapsedSectionIds,
  );

  const persistCollapsed = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(
        CHAT_SIDEBAR_COLLAPSED_KEY,
        JSON.stringify([...next]),
      );
    } catch {
      // ignore quota / private mode
    }
  }, []);

  const toggleSectionCollapsed = useCallback(
    (sectionId: string) => {
      setCollapsedSectionIds((prev) => {
        const next = new Set(prev);
        if (next.has(sectionId)) {
          next.delete(sectionId);
        } else {
          next.add(sectionId);
        }
        persistCollapsed(next);
        return next;
      });
    },
    [persistCollapsed],
  );

  const canCreateChannel = layout?.viewer.isWorkspaceAdmin === true;

  const channelsByCategory = useMemo(() => {
    if (!layout) {
      return [];
    }

    const query = search.trim().toLowerCase();

    return layout.categories.map((category) => ({
      ...category,
      channels: category.channels.filter((channel) => {
        if (!channel.canRead) {
          return false;
        }

        if (query.length === 0) {
          return true;
        }

        return (
          channel.name.toLowerCase().includes(query) ||
          channel.slug.toLowerCase().includes(query)
        );
      }),
    }));
  }, [layout, search]);

  const directThreads = useMemo(() => {
    if (!layout) {
      return [];
    }

    const query = search.trim().toLowerCase();

    if (query.length === 0) {
      return layout.directThreads;
    }

    return layout.directThreads.filter((dm) =>
      (dm.title ?? '').toLowerCase().includes(query),
    );
  }, [layout, search]);

  const handleNav = (path: string) => {
    navigate(path);
    onMobileNavigate?.();
  };

  return (
    <ChatSidebarFrame
      mobileHeader={
        <>
          <span>{t`Conversations`}</span>
          {onMobileNavigate ? (
            <LightIconButton
              Icon={IconX}
              accent="tertiary"
              size="small"
              aria-label={t`Close list`}
              onClick={onMobileNavigate}
            />
          ) : null}
        </>
      }
    >
      <ChatSearchField
        value={search}
        onChange={setSearch}
        placeholder={t`Search channels & DMs`}
      />

      <StyledScroll>
        {error && (
          <StyledErrorText>
            {t`Couldn't load chat`}: {error}
          </StyledErrorText>
        )}

        {channelsByCategory.map((category) => {
          const sectionCollapsed = collapsedSectionIds.has(category.id);
          return (
            <ChatSidebarSection key={category.id}>
              <ChatSidebarSectionLabel
                label={category.name || t`Channels`}
                collapse={{
                  expanded: !sectionCollapsed,
                  onToggle: () => toggleSectionCollapsed(category.id),
                  toggleAriaLabel: sectionCollapsed
                    ? t`Expand section`
                    : t`Collapse section`,
                }}
                actions={
                  canCreateChannel ? (
                    <LightIconButton
                      Icon={IconPlus}
                      accent="tertiary"
                      size="small"
                      aria-label={t`New channel`}
                      onClick={() => setIsCreateChannelOpen(true)}
                    />
                  ) : null
                }
              />
              {sectionCollapsed ? null : category.channels.length === 0 ? (
                <StyledEmptyHint>{t`No channels`}</StyledEmptyHint>
              ) : (
                category.channels.map((channel) => (
                  <ChatConversationRow
                    key={channel.id}
                    label={channel.name || channel.slug}
                    Icon={
                      channel.visibility === 'private' ? IconLock : IconMessage
                    }
                    active={activeChannelId === channel.id}
                    unread={channel.unreadCount}
                    onClick={() => handleNav(`/chat/c/${channel.id}`)}
                  />
                ))
              )}
            </ChatSidebarSection>
          );
        })}

        <ChatSidebarSection>
          <ChatSidebarSectionLabel
            label={t`Direct messages`}
            collapse={{
              expanded: !collapsedSectionIds.has(DM_SECTION_COLLAPSE_ID),
              onToggle: () => toggleSectionCollapsed(DM_SECTION_COLLAPSE_ID),
              toggleAriaLabel: collapsedSectionIds.has(DM_SECTION_COLLAPSE_ID)
                ? t`Expand section`
                : t`Collapse section`,
            }}
            actions={
              <LightIconButton
                Icon={IconPlus}
                accent="tertiary"
                size="small"
                aria-label={t`Start a DM`}
                onClick={() => setIsNewDmOpen(true)}
              />
            }
          />
          {collapsedSectionIds.has(DM_SECTION_COLLAPSE_ID) ? null : directThreads
              .length === 0 ? (
            <StyledEmptyHint>{t`No direct messages yet`}</StyledEmptyHint>
          ) : (
            directThreads.map((dm) => (
              <ChatConversationRow
                key={dm.id}
                label={dm.title ?? t`Direct message`}
                Icon={dm.kind === 'group' ? IconUsers : IconMessage}
                active={activeDmId === dm.id}
                unread={dm.unreadCount}
                onClick={() => handleNav(`/chat/dm/${dm.id}`)}
              />
            ))
          )}
        </ChatSidebarSection>
      </StyledScroll>

      <StyledFooterActions>
        {canCreateChannel && (
          <Button
            title={t`Create channel`}
            Icon={IconPlus}
            variant="secondary"
            size="small"
            onClick={() => setIsCreateChannelOpen(true)}
            fullWidth
          />
        )}
        <Button
          title={t`New direct message`}
          Icon={IconPlus}
          variant="secondary"
          size="small"
          onClick={() => setIsNewDmOpen(true)}
          fullWidth
        />
      </StyledFooterActions>

      {isCreateChannelOpen && (
        <CreateChannelModal
          isOpen
          onClose={() => setIsCreateChannelOpen(false)}
          token={token}
          layout={layout}
          onCreated={(channelId) => {
            setIsCreateChannelOpen(false);
            handleNav(`/chat/c/${channelId}`);
          }}
          onLayoutRefresh={() => {
            void reload();
          }}
        />
      )}

      {isNewDmOpen && (
        <NewDmModal
          isOpen
          onClose={() => setIsNewDmOpen(false)}
          token={token}
          viewerUserWorkspaceId={layout?.viewer.userWorkspaceId}
          onCreated={(threadId) => {
            setIsNewDmOpen(false);
            handleNav(`/chat/dm/${threadId}`);
          }}
          onLayoutRefresh={() => {
            void reload();
          }}
        />
      )}
    </ChatSidebarFrame>
  );
};
