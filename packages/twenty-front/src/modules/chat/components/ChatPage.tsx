import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { ChatComposer } from '@/chat/components/ChatComposer';
import { ChatMessageList } from '@/chat/components/ChatMessageList';
import { useChatWorkspaceLayout } from '@/chat/hooks/useChatWorkspaceLayout';
import { useSendbirdChannel } from '@/chat/hooks/useSendbirdChannel';
import { useSendbirdClient } from '@/chat/providers/SendbirdClientProvider';
import { useSendbirdCalls } from '@/chat/providers/SendbirdCallsProvider';
import {
  type ChatWorkspaceLayoutChannel,
  type ChatWorkspaceLayoutDm,
} from '@/chat/types/chat-workspace-layout.type';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import {
  IconHash,
  IconLock,
  IconMessageCircle,
  IconPhone,
  IconUsers,
  IconVideo,
} from 'twenty-ui/display';
import { LightIconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledChatSurface = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
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

type ActiveSelection =
  | { kind: 'channel'; channel: ChatWorkspaceLayoutChannel }
  | { kind: 'dm'; dm: ChatWorkspaceLayoutDm }
  | null;

const resolveIcon = (selection: ActiveSelection) => {
  if (!selection) return IconMessageCircle;
  if (selection.kind === 'channel') {
    return selection.channel.visibility === 'private' ? IconLock : IconHash;
  }
  return selection.dm.kind === 'group' ? IconUsers : IconMessageCircle;
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
  const params = useParams<{ channelId?: string; dmThreadId?: string }>();
  const { layout, isLoading: layoutLoading, error: layoutError } =
    useChatWorkspaceLayout();
  const { sb, connectError } = useSendbirdClient();
  const { dialDirect } = useSendbirdCalls();

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

  const channelUrl =
    selection?.kind === 'channel'
      ? selection.channel.sendbirdChannelUrl
      : selection?.kind === 'dm'
        ? selection.dm.sendbirdChannelUrl
        : null;

  const canPost =
    selection?.kind === 'dm' ||
    (selection?.kind === 'channel' && selection.channel.canPost);

  const {
    messages,
    typingMembers,
    sendMessage,
    sendFile,
    sendTypingStart,
    sendTypingEnd,
    error: channelError,
    isLoading: channelLoading,
  } = useSendbirdChannel({ channelUrl });

  const title = selection
    ? resolveTitle(selection, t`Direct message`)
    : t`Chat`;
  const Icon = resolveIcon(selection);

  const dmPeerSendbirdUserId =
    selection?.kind === 'dm' && selection.dm.kind === 'direct'
      ? selection.dm.peerAgoraUserId
      : null;

  const handleVoiceCall = () => {
    if (!dmPeerSendbirdUserId) {
      return;
    }
    dialDirect({
      peerUserId: dmPeerSendbirdUserId,
      isVideoCall: false,
      title,
    });
  };

  const handleVideoCall = () => {
    if (!dmPeerSendbirdUserId) {
      return;
    }
    dialDirect({
      peerUserId: dmPeerSendbirdUserId,
      isVideoCall: true,
      title,
    });
  };

  const errorMessage = connectError ?? channelError ?? layoutError;

  return (
    <>
      <PageHeader title={title} Icon={Icon}>
        {selection && channelUrl && dmPeerSendbirdUserId && (
          <>
            <LightIconButton
              Icon={IconPhone}
              accent="tertiary"
              size="medium"
              aria-label={t`Voice call`}
              onClick={handleVoiceCall}
            />
            <LightIconButton
              Icon={IconVideo}
              accent="tertiary"
              size="medium"
              aria-label={t`Video call`}
              onClick={handleVideoCall}
            />
          </>
        )}
      </PageHeader>
      <PageBody>
        <StyledChatSurface>
          {errorMessage ? (
            <StyledError>{errorMessage}</StyledError>
          ) : !sb || layoutLoading ? (
            <StyledEmptyState>{t`Connecting…`}</StyledEmptyState>
          ) : !selection ? (
            <StyledEmptyState>
              {t`Pick a channel or conversation on the left to start chatting.`}
            </StyledEmptyState>
          ) : !channelUrl ? (
            <StyledEmptyState>
              {t`This conversation isn't connected to Sendbird yet.`}
            </StyledEmptyState>
          ) : channelLoading && messages.length === 0 ? (
            <StyledEmptyState>{t`Loading messages…`}</StyledEmptyState>
          ) : (
            <>
              <ChatMessageList
                messages={messages}
                typingMembers={typingMembers}
              />
              {canPost ? (
                <ChatComposer
                  onSend={sendMessage}
                  onSendFile={sendFile}
                  onTypingStart={sendTypingStart}
                  onTypingEnd={sendTypingEnd}
                  placeholder={t`Message ${title}`}
                />
              ) : (
                <StyledEmptyState>
                  {t`You don't have permission to post in this channel.`}
                </StyledEmptyState>
              )}
            </>
          )}
        </StyledChatSurface>
      </PageBody>
    </>
  );
};
