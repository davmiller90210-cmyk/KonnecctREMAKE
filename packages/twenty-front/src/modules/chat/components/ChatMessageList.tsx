/* eslint-disable twenty/no-state-useref -- scroll pinning requires direct DOM refs */
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import {
  type NativeChatMessage,
  type NativeTypingMember,
} from '@/chat/types/native-chat-message.type';
import { type NativeChatReadState } from '@/chat/types/native-chat-read-state.type';
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ChatJumpToLatestButton } from '@/chat/ui/thread/ChatJumpToLatestButton';
import { ChatMessageCluster } from '@/chat/ui/thread/ChatMessageCluster';
import { ChatTimelineRule } from '@/chat/ui/thread/ChatTimelineRule';
import { ChatTypingPulse } from '@/chat/ui/thread/ChatTypingPulse';
import {
  NATIVE_CHAT_OPTIMISTIC_ID_PREFIX,
  getNativeMessageSenderId,
  nativeMessageBody,
} from '@/chat/hooks/useNativeChatChannel';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledWrap = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  position: relative;
`;

const StyledList = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  overflow-x: hidden;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
  padding-bottom: ${themeCssVariables.spacing[10]};
`;

const StyledAdminRow = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[4]};
  text-align: center;
`;

const StyledEmptyState = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex: 1 1 auto;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  justify-content: center;
  padding: ${themeCssVariables.spacing[4]};
`;

const GROUPING_WINDOW_MS = 5 * 60 * 1000;
const SCROLL_NEAR_BOTTOM_PX = 88;

const formatTime = (ts: number) => {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const senderName = (message: NativeChatMessage) => {
  const firstName = message.sender?.firstName?.trim();
  const lastName = message.sender?.lastName?.trim();
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  return fullName.length > 0 ? fullName : 'System';
};

const senderAvatarUrl = (message: NativeChatMessage): string | null => {
  return message.sender?.avatarUrl ?? null;
};

const peerDisplayName = (peer: {
  firstName: string;
  lastName: string;
}) => {
  const name = `${peer.firstName ?? ''} ${peer.lastName ?? ''}`.trim();
  return name.length > 0 ? name : 'Member';
};

const readersThroughMessage = (
  readState: NativeChatReadState,
  messageCreatedAt: string,
) => {
  const t = new Date(messageCreatedAt).getTime();
  return readState.others.filter((other) => {
    if (!other.lastReadAt) {
      return false;
    }
    return new Date(other.lastReadAt).getTime() >= t;
  });
};

type ChatMessageListProps = {
  messages: NativeChatMessage[];
  typingMembers: NativeTypingMember[];
  readState: NativeChatReadState | null;
  viewerUserWorkspaceId: string | null;
  conversationKind: 'channel' | 'dm' | null;
  dmKind: 'direct' | 'group' | null;
  highlightMessageId: string | null;
  canPin: boolean;
  onToggleReaction: (
    messageId: string,
    emoji: string,
    remove: boolean,
  ) => Promise<void>;
  onPinMessage: (messageId: string) => Promise<void>;
  onUnpinMessage: (messageId: string) => Promise<void>;
  onEditMessage?: (messageId: string, currentBody: string) => void;
  onDeleteMessage?: (messageId: string) => void;
};

export const ChatMessageList = ({
  messages,
  typingMembers,
  readState,
  viewerUserWorkspaceId,
  conversationKind,
  dmKind,
  highlightMessageId,
  canPin,
  onToggleReaction,
  onPinMessage,
  onUnpinMessage,
  onEditMessage,
  onDeleteMessage,
}: ChatMessageListProps) => {
  const { t } = useLingui();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const nearBottomRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const lastOwnMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.kind === 'system') {
        continue;
      }
      if (message.isDeleted) {
        continue;
      }
      if (message.id.startsWith(NATIVE_CHAT_OPTIMISTIC_ID_PREFIX)) {
        continue;
      }
      const sid = getNativeMessageSenderId(message);
      if (sid && sid === viewerUserWorkspaceId) {
        return message.id;
      }
    }
    return null;
  }, [messages, viewerUserWorkspaceId]);

  const newDividerIndex = useMemo(() => {
    if (!readState?.viewerLastReadAt) {
      return -1;
    }
    const cutoff = new Date(readState.viewerLastReadAt).getTime();
    return messages.findIndex((message) => {
      if (message.kind === 'system') {
        return false;
      }
      return new Date(message.createdAt).getTime() > cutoff;
    });
  }, [messages, readState]);

  const readReceiptForMessage = useCallback(
    (message: NativeChatMessage): string | null => {
      if (
        !readState ||
        !viewerUserWorkspaceId ||
        message.kind === 'system' ||
        message.isDeleted ||
        message.id !== lastOwnMessageId
      ) {
        return null;
      }
      const readers = readersThroughMessage(readState, message.createdAt);
      if (readers.length === 0) {
        return null;
      }
      const isDirectOneToOne =
        conversationKind === 'dm' && dmKind === 'direct';
      if (isDirectOneToOne && readers.length >= 1) {
        return t`Seen`;
      }
      if (readers.length === 1) {
        return t`Read by ${peerDisplayName(readers[0])}`;
      }
      if (readers.length <= 3) {
        return t`Read by ${readers.map(peerDisplayName).join(', ')}`;
      }
      return t`Read by ${readers.length} people`;
    },
    [
      conversationKind,
      dmKind,
      lastOwnMessageId,
      readState,
      t,
      viewerUserWorkspaceId,
    ],
  );

  const formatDayLabel = useCallback(
    (iso: string) => {
      const date = new Date(iso);
      const startToday = new Date();
      startToday.setHours(0, 0, 0, 0);
      const startYesterday = new Date(startToday);
      startYesterday.setDate(startYesterday.getDate() - 1);
      const t0 = date.setHours(0, 0, 0, 0);
      if (t0 === startToday.getTime()) {
        return t`Today`;
      }
      if (t0 === startYesterday.getTime()) {
        return t`Yesterday`;
      }
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year:
          date.getFullYear() !== startToday.getFullYear()
            ? 'numeric'
            : undefined,
      });
    },
    [t],
  );

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distanceFromBottom < SCROLL_NEAR_BOTTOM_PX;
    nearBottomRef.current = near;
    setShowJumpToLatest(!near && messages.length > 0);
  }, [messages.length]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const latest = messages[messages.length - 1] ?? null;
    const latestId = latest?.id ?? null;
    const isNewBatch = latestId !== lastMessageIdRef.current;
    lastMessageIdRef.current = latestId;
    const senderId = latest ? getNativeMessageSenderId(latest) : null;
    const fromViewer = Boolean(
      viewerUserWorkspaceId && senderId === viewerUserWorkspaceId,
    );
    if (isNewBatch && (nearBottomRef.current || fromViewer)) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, viewerUserWorkspaceId]);

  const scrollToLatest = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    nearBottomRef.current = true;
    setShowJumpToLatest(false);
  }, []);

  if (messages.length === 0) {
    return (
      <StyledWrap>
        <StyledList ref={containerRef}>
          <StyledEmptyState>
            {t`No messages yet — send the first one below.`}
          </StyledEmptyState>
        </StyledList>
      </StyledWrap>
    );
  }

  let lastRenderedDayKey: string | null = null;

  const renderedMessages: ReactNode[] = messages.flatMap((message, index) => {
    const nodes: ReactNode[] = [];

    if (message.kind !== 'system') {
      const dk = dayKey(message.createdAt);
      if (dk !== lastRenderedDayKey) {
        lastRenderedDayKey = dk;
        nodes.push(
          <ChatTimelineRule
            key={`day-${dk}-${index}`}
            variant="day"
            label={formatDayLabel(message.createdAt)}
          />,
        );
      }
    }

    if (index === newDividerIndex && newDividerIndex >= 0) {
      nodes.push(
        <ChatTimelineRule
          key={`new-${message.id}`}
          variant="new"
          label={t`New`}
        />,
      );
    }

    if (message.kind === 'system') {
      nodes.push(
        <StyledAdminRow key={message.id}>{message.body}</StyledAdminRow>,
      );
      return nodes;
    }

    const prev = messages[index - 1];
    const prevSenderId = prev ? getNativeMessageSenderId(prev) : undefined;
    const currentSenderId = getNativeMessageSenderId(message);
    const isNewGroup =
      !prev ||
      prev.kind === 'system' ||
      prevSenderId !== currentSenderId ||
      new Date(message.createdAt).getTime() -
        new Date(prev.createdAt).getTime() >
        GROUPING_WINDOW_MS;

    const isOwn = Boolean(
      viewerUserWorkspaceId &&
        currentSenderId &&
        currentSenderId === viewerUserWorkspaceId,
    );
    const receipt = readReceiptForMessage(message);

    nodes.push(
      <ChatMessageCluster
        key={message.id}
        messageId={message.id}
        isOwn={isOwn}
        isGroupStart={isNewGroup}
        showAvatar={isNewGroup}
        showHeader={isNewGroup}
        authorLabel={senderName(message)}
        timeLabel={formatTime(new Date(message.createdAt).getTime())}
        avatarUrl={senderAvatarUrl(message)}
        body={nativeMessageBody(message)}
        crmMentionSnapshots={message.crmMentionSnapshots}
        readReceipt={receipt}
        reactions={message.reactions}
        isPinned={message.isPinned}
        highlightSend={highlightMessageId === message.id}
        canPin={canPin}
        isDeleted={Boolean(message.isDeleted)}
        isEdited={Boolean(message.editedAt)}
        onToggleReaction={(emoji, remove) =>
          onToggleReaction(message.id, emoji, remove)
        }
        onPin={() => onPinMessage(message.id)}
        onUnpin={() => onUnpinMessage(message.id)}
        onEditMessage={
          isOwn && !message.isDeleted && onEditMessage
            ? () => onEditMessage(message.id, message.body)
            : undefined
        }
        onDeleteMessage={
          isOwn && !message.isDeleted && onDeleteMessage
            ? () => onDeleteMessage(message.id)
            : undefined
        }
      />,
    );

    return nodes;
  });

  const typingLabel =
    typingMembers.length === 1
      ? t`${typingMembers[0].nickname} is typing…`
      : t`Several people are typing…`;

  return (
    <StyledWrap>
      <StyledList ref={containerRef} onScroll={handleScroll}>
        {renderedMessages}

        {typingMembers.length > 0 ? (
          <ChatTypingPulse label={typingLabel} />
        ) : null}
      </StyledList>
      {showJumpToLatest ? (
        <ChatJumpToLatestButton
          label={t`Jump to latest`}
          onClick={scrollToLatest}
        />
      ) : null}
    </StyledWrap>
  );
};
