import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import {
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import { tokenPairState } from '@/auth/states/tokenPairState';
import {
  ChatComposer,
  type ChatComposerHandle,
} from '@/chat/components/ChatComposer';
import { ChatPinnedMessagesStrip } from '@/chat/components/ChatPinnedMessagesStrip';
import { ChatContextPanel } from '@/chat/components/ChatContextPanel';
import { ChatConversationListPanel } from '@/chat/components/ChatConversationListPanel';
import { ChatInAppNotificationsPopover } from '@/chat/components/ChatInAppNotificationsPopover';
import { ChatMessageList } from '@/chat/components/ChatMessageList';
import { ChatQuickSwitcher } from '@/chat/components/ChatQuickSwitcher';
import { ChatMessageThreadSkeleton } from '@/chat/ui/thread/ChatMessageThreadSkeleton';
import { ChatThreadFrame } from '@/chat/ui/thread/ChatThreadFrame';
import { useChatWorkspaceLayout } from '@/chat/hooks/useChatWorkspaceLayout';
import {
  isChatSendSoundEnabled,
  setChatSendSoundEnabled,
} from '@/chat/constants/chatSendSoundStorage';
import {
  NATIVE_CHAT_OPTIMISTIC_ID_PREFIX,
  useNativeChatChannel,
} from '@/chat/hooks/useNativeChatChannel';
import {
  type ChatWorkspaceLayoutChannel,
  type ChatWorkspaceLayoutDm,
  type ChatWorkspaceLayoutResponse,
} from '@/chat/types/chat-workspace-layout.type';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { useIsMobile } from '@/ui/utilities/responsive/hooks/useIsMobile';
import {
  IconLayoutSidebarRightExpand,
  IconList,
  IconLock,
  IconMessage,
  IconPlayerPlay,
  IconPlayerStop,
  IconSearch,
  IconUsers,
} from 'twenty-ui/display';
import { Button, LightIconButton } from 'twenty-ui/input';
import { MOBILE_VIEWPORT, themeCssVariables } from 'twenty-ui/theme-constants';

const DETAILS_BREAKPOINT_PX = 1100;

const StyledWorkspace = styled.div`
  display: flex;
  flex: 1 1 auto;
  gap: ${themeCssVariables.spacing[2]};
  min-height: 0;
  width: 100%;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    flex-direction: column;
    gap: 0;
    position: relative;
  }
`;

const StyledListColumn = styled.div<{ $mobileOpen: boolean }>`
  flex-shrink: 0;
  width: 280px;
  min-height: 0;
  display: flex;
  flex-direction: column;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    background: ${themeCssVariables.background.primary};
    bottom: 0;
    box-shadow: ${themeCssVariables.boxShadow.strong};
    display: ${({ $mobileOpen }) => ($mobileOpen ? 'flex' : 'none')};
    left: 0;
    position: absolute;
    top: 0;
    width: 100%;
    z-index: 2;
  }
`;

const StyledThreadColumn = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
`;

const StyledDetailsColumn = styled.div<{ $open: boolean }>`
  flex-shrink: 0;
  width: 300px;
  min-height: 0;
  display: ${({ $open }) => ($open ? 'flex' : 'none')};
  flex-direction: column;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    display: none;
  }
`;

const StyledEmptyState = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex: 1 1 auto;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  justify-content: center;
  padding: ${themeCssVariables.spacing[8]};
  text-align: center;
`;

const StyledError = styled.div`
  color: ${themeCssVariables.color.red};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledEmptyCta = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  max-width: 360px;
`;

const findFirstChatPath = (
  layout: ChatWorkspaceLayoutResponse,
): string | null => {
  for (const category of layout.categories) {
    for (const channel of category.channels) {
      if (channel.canRead) {
        return `/chat/c/${channel.id}`;
      }
    }
  }
  const firstDm = layout.directThreads[0];
  return firstDm ? `/chat/dm/${firstDm.id}` : null;
};

type ActiveSelection =
  | { kind: 'channel'; channel: ChatWorkspaceLayoutChannel }
  | { kind: 'dm'; dm: ChatWorkspaceLayoutDm }
  | null;

const resolveIcon = (selection: ActiveSelection) => {
  if (!selection) return IconMessage;
  if (selection.kind === 'channel') {
    return selection.channel.visibility === 'private' ? IconLock : IconMessage;
  }
  return selection.dm.kind === 'group' ? IconUsers : IconMessage;
};

const resolveTitle = (selection: ActiveSelection, fallback: string) => {
  if (!selection) return fallback;
  if (selection.kind === 'channel') {
    return selection.channel.name || selection.channel.slug;
  }
  return selection.dm.title?.trim() || fallback;
};

export const ChatPage = () => {
  const { t } = useLingui();
  const { enqueueErrorSnackBar } = useSnackBar();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const params = useParams<{ channelId?: string; dmThreadId?: string }>();
  const [searchParams] = useSearchParams();
  const composerRef = useRef<ChatComposerHandle>(null);
  const tokenPair = useAtomValue(tokenPairState.atom);
  const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const {
    layout,
    isLoading: layoutLoading,
    error: layoutError,
    reload: reloadChatLayout,
  } = useChatWorkspaceLayout();

  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.innerWidth >= DETAILS_BREAKPOINT_PX,
  );
  const [sendSoundOn, setSendSoundOn] = useState(() =>
    isChatSendSoundEnabled(),
  );

  useEffect(() => {
    if (isMobile) {
      setDetailsOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'k') {
        e.preventDefault();
        setQuickSwitcherOpen((open) => !open);
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setQuickSwitcherOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selection = useMemo<ActiveSelection>(() => {
    if (!layout) return null;

    if (params.channelId) {
      for (const category of layout.categories) {
        const match = category.channels.find((c) => c.id === params.channelId);
        if (match) {
          return { kind: 'channel', channel: match };
        }
      }
    }

    if (params.dmThreadId) {
      const dm = layout.directThreads.find((d) => d.id === params.dmThreadId);
      if (dm) {
        return { kind: 'dm', dm };
      }
    }

    return null;
  }, [layout, params.channelId, params.dmThreadId]);

  const selectedChannelId =
    selection?.kind === 'channel' ? selection.channel.id : null;
  const selectedDmThreadId = selection?.kind === 'dm' ? selection.dm.id : null;

  useEffect(() => {
    if (layoutLoading || !layout) {
      return;
    }
    if (params.channelId || params.dmThreadId) {
      return;
    }
    const next = findFirstChatPath(layout);
    if (next) {
      navigate(next, { replace: true });
    }
  }, [layout, layoutLoading, navigate, params.channelId, params.dmThreadId]);

  const viewerProfile = useMemo(() => {
    if (!layout?.viewer.userWorkspaceId) {
      return null;
    }
    const member = layout.workspaceMembers.find(
      (m) => m.userWorkspaceId === layout.viewer.userWorkspaceId,
    );
    if (!member) {
      return {
        userWorkspaceId: layout.viewer.userWorkspaceId,
        firstName: '',
        lastName: '',
        avatarUrl: null as string | null,
      };
    }
    return {
      userWorkspaceId: member.userWorkspaceId,
      firstName: member.firstName,
      lastName: member.lastName,
      avatarUrl: member.avatarUrl,
    };
  }, [layout]);

  const nativeConversationId = useMemo(() => {
    if (selection?.kind === 'channel') {
      return selection.channel.nativeConversationId;
    }
    if (selection?.kind === 'dm') {
      return selection.dm.nativeConversationId;
    }
    return null;
  }, [selection]);

  const canPost =
    selection?.kind === 'dm' ||
    (selection?.kind === 'channel' && selection.channel.canPost);

  const canPin =
    selection?.kind === 'channel'
      ? selection.channel.canManage ||
        (selection.channel.visibility === 'public' &&
          selection.channel.canPost)
      : Boolean(selection?.kind === 'dm');

  const viewerDisplayName = useMemo(() => {
    if (!layout?.viewer.userWorkspaceId) {
      return '';
    }
    const member = layout.workspaceMembers.find(
      (m) => m.userWorkspaceId === layout.viewer.userWorkspaceId,
    );
    const name = [member?.firstName, member?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return name.length > 0 ? name : member?.email?.trim() || '';
  }, [layout]);

  const {
    messages,
    pinnedMessages,
    readState,
    typingMembers,
    sendMessage,
    markAsRead,
    sendTypingStart,
    sendTypingEnd,
    loadError: channelLoadError,
    isLoading: channelLoading,
    toggleReaction,
    pinMessage,
    unpinMessage,
    highlightMessageId,
  } = useNativeChatChannel({
    channelId: selectedChannelId,
    dmThreadId: selectedDmThreadId,
    nativeConversationId,
    viewerUserWorkspaceId: layout?.viewer.userWorkspaceId,
    viewerProfile,
    onConversationRealtime: reloadChatLayout,
  });

  const latestMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const id = messages[i]?.id;
      if (id && !id.startsWith(NATIVE_CHAT_OPTIMISTIC_ID_PREFIX)) {
        return id;
      }
    }
    return null;
  }, [messages]);

  useEffect(() => {
    if (!selectedChannelId && !selectedDmThreadId) {
      return;
    }
    composerRef.current?.focusMessageInput();
  }, [selectedChannelId, selectedDmThreadId]);

  useEffect(() => {
    const onVis = () => {
      if (
        document.visibilityState === 'visible' &&
        (selectedChannelId || selectedDmThreadId)
      ) {
        markAsRead(latestMessageId);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [latestMessageId, markAsRead, selectedChannelId, selectedDmThreadId]);

  useEffect(() => {
    if (!selectedChannelId && !selectedDmThreadId) {
      return;
    }
    const timer = window.setTimeout(() => {
      markAsRead(latestMessageId);
    }, 320);
    return () => {
      window.clearTimeout(timer);
    };
  }, [latestMessageId, markAsRead, selectedChannelId, selectedDmThreadId]);

  useEffect(() => {
    if (!token) {
      return;
    }
    const recordObjectName = searchParams.get('recordObjectName');
    const recordId = searchParams.get('recordId');
    if (!recordObjectName || !recordId) {
      return;
    }

    if (!selectedChannelId && !selectedDmThreadId) {
      return;
    }

    void fetch('/chat/record-link', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channelId: selectedChannelId,
        dmThreadId: selectedDmThreadId,
        objectNameSingular: recordObjectName,
        recordId,
      }),
    }).catch(() => {});
  }, [searchParams, selectedChannelId, selectedDmThreadId, token]);

  const title = selection
    ? resolveTitle(selection, t`Direct message`)
    : t`Chat`;
  const Icon = resolveIcon(selection);

  const errorMessage = channelLoadError ?? layoutError;

  const contextSelection = selection;

  const mentionUserCandidates = useMemo(() => {
    if (!layout?.workspaceMembers?.length) {
      return [];
    }
    const viewerId = layout.viewer.userWorkspaceId;
    return layout.workspaceMembers
      .filter((member) => member.userWorkspaceId !== viewerId)
      .map((member) => ({
        userId: member.userWorkspaceId,
        label:
          [member.firstName, member.lastName].filter(Boolean).join(' ').trim() ||
          member.email,
      }));
  }, [layout]);

  const notificationUnreadCount = layout?.notificationUnreadCount ?? 0;

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string, remove: boolean) => {
      try {
        await toggleReaction(messageId, emoji, remove);
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error
              ? error.message
              : t`Could not update reaction`,
        });
      }
    },
    [enqueueErrorSnackBar, t, toggleReaction],
  );

  const handlePinMessage = useCallback(
    async (messageId: string) => {
      try {
        await pinMessage(messageId);
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error ? error.message : t`Could not pin message`,
        });
      }
    },
    [enqueueErrorSnackBar, pinMessage, t],
  );

  const handleUnpinMessage = useCallback(
    async (messageId: string) => {
      try {
        await unpinMessage(messageId);
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error
              ? error.message
              : t`Could not unpin message`,
        });
      }
    },
    [enqueueErrorSnackBar, t, unpinMessage],
  );

  const scrollToChatMessage = (messageId: string) => {
    document
      .getElementById(`chat-msg-${messageId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <>
      <PageHeader title={title} Icon={Icon}>
        <LightIconButton
          Icon={IconSearch}
          accent="tertiary"
          size="medium"
          title={t`Jump to conversation (Ctrl/⌘+K or Ctrl+Shift+G)`}
          aria-label={t`Jump to conversation`}
          onClick={() => setQuickSwitcherOpen(true)}
        />
        <ChatInAppNotificationsPopover
          token={token}
          unreadCount={notificationUnreadCount}
          onChanged={() => void reloadChatLayout()}
        />
        <LightIconButton
          Icon={sendSoundOn ? IconPlayerStop : IconPlayerPlay}
          accent="tertiary"
          size="medium"
          title={
            sendSoundOn
              ? t`Send sound on — click to mute`
              : t`Send sound off — click to enable`
          }
          aria-label={
            sendSoundOn
              ? t`Send sound on — click to mute`
              : t`Send sound off — click to enable`
          }
          onClick={() => {
            const next = !sendSoundOn;
            setSendSoundOn(next);
            setChatSendSoundEnabled(next);
          }}
        />
        {isMobile && (
          <LightIconButton
            Icon={IconList}
            accent="tertiary"
            size="medium"
            aria-label={t`Conversations`}
            onClick={() => setMobileListOpen(true)}
          />
        )}
        {!isMobile && (
          <LightIconButton
            Icon={IconLayoutSidebarRightExpand}
            accent="tertiary"
            size="medium"
            aria-label={detailsOpen ? t`Hide details` : t`Show details`}
            onClick={() => setDetailsOpen((v) => !v)}
          />
        )}
      </PageHeader>
      <PageBody>
        <StyledWorkspace>
          <StyledListColumn $mobileOpen={mobileListOpen}>
            <ChatConversationListPanel
              onMobileNavigate={
                isMobile ? () => setMobileListOpen(false) : undefined
              }
            />
          </StyledListColumn>

          <StyledThreadColumn>
            <ChatThreadFrame>
              {errorMessage ? (
                <StyledError>{errorMessage}</StyledError>
              ) : layoutLoading ? (
                <StyledEmptyState>{t`Connecting…`}</StyledEmptyState>
              ) : !selection ? (
                <StyledEmptyState>
                  <StyledEmptyCta>
                    <span>{t`Pick a channel or conversation to start chatting.`}</span>
                    <Button
                      title={t`Browse conversations`}
                      variant="primary"
                      accent="blue"
                      onClick={() => setQuickSwitcherOpen(true)}
                    />
                  </StyledEmptyCta>
                </StyledEmptyState>
              ) : channelLoading && messages.length === 0 ? (
                <ChatMessageThreadSkeleton />
              ) : (
                <>
                  <ChatPinnedMessagesStrip
                    pins={pinnedMessages}
                    onSelectMessageId={scrollToChatMessage}
                  />
                  <ChatMessageList
                    key={`${selectedChannelId ?? ''}:${selectedDmThreadId ?? ''}`}
                    messages={messages}
                    typingMembers={typingMembers}
                    readState={readState}
                    viewerUserWorkspaceId={
                      layout?.viewer.userWorkspaceId ?? null
                    }
                    conversationKind={
                      selection.kind === 'channel' ? 'channel' : 'dm'
                    }
                    dmKind={
                      selection.kind === 'dm' ? selection.dm.kind : null
                    }
                    highlightMessageId={highlightMessageId}
                    canPin={canPin}
                    onToggleReaction={handleToggleReaction}
                    onPinMessage={handlePinMessage}
                    onUnpinMessage={handleUnpinMessage}
                  />
                  {canPost ? (
                    <ChatComposer
                      ref={composerRef}
                      onSend={sendMessage}
                      onTypingStart={sendTypingStart}
                      onTypingEnd={sendTypingEnd}
                      placeholder={t`Message ${title}`}
                      mentionUserCandidates={mentionUserCandidates}
                      viewerDisplayName={viewerDisplayName}
                      onCollapseThreadUi={() => setDetailsOpen(false)}
                      gifPickerToken={token}
                    />
                  ) : (
                    <StyledEmptyState>
                      {t`You don't have permission to post in this channel.`}
                    </StyledEmptyState>
                  )}
                </>
              )}
            </ChatThreadFrame>
          </StyledThreadColumn>

          <StyledDetailsColumn $open={detailsOpen}>
            <ChatContextPanel
              selection={contextSelection}
              onClose={() => setDetailsOpen(false)}
            />
          </StyledDetailsColumn>
        </StyledWorkspace>
      </PageBody>
      <ChatQuickSwitcher
        isOpen={quickSwitcherOpen}
        onClose={() => setQuickSwitcherOpen(false)}
        layout={layout ?? null}
        onAfterNavigate={
          isMobile ? () => setMobileListOpen(false) : undefined
        }
      />
    </>
  );
};
