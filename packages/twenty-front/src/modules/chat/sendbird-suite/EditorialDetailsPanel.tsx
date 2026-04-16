import { t } from '@lingui/core/macro';
import type { GroupChannel } from '@sendbird/chat/groupChannel';
import { Avatar, IconWorld } from 'twenty-ui/display';

import { editorialChatTheme } from '@/chat/theme/editorialChatTheme';
import type {
  ChatHubSelection,
  ChatWorkspaceMemberOption,
} from '@/chat/types/chat-workspace-layout.type';
import * as Ed from './editorialLayout';

export type EditorialDetailsPanelProps = {
  selection: ChatHubSelection | null;
  groupChannel: GroupChannel | null;
  channelTopic: string;
  pinnedMessages: { messageId: number; preview: string }[];
  mediaThumbs: { url: string; id: number }[];
  onLeaveChannel: () => void;
  dmPeerMember: ChatWorkspaceMemberOption | undefined;
  memberDisplayName: (member: ChatWorkspaceMemberOption) => string;
};

export const EditorialDetailsPanel = ({
  selection,
  groupChannel,
  channelTopic,
  pinnedMessages,
  mediaThumbs,
  onLeaveChannel,
  dmPeerMember,
  memberDisplayName,
}: EditorialDetailsPanelProps) => (
  <Ed.StyledDetailsColumn>
    <Ed.StyledDetailsHeader>
      <Ed.StyledDetailsTitle>{t`Details`}</Ed.StyledDetailsTitle>
    </Ed.StyledDetailsHeader>
    <Ed.StyledDetailsScroll>
      {selection?.kind === 'channel' && groupChannel ? (
        <>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div
              style={{
                width: 96,
                height: 96,
                margin: '0 auto 12px',
                borderRadius: 16,
                background: editorialChatTheme.surfaceContainerHighest,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconWorld size={32} />
            </div>
            <div style={{ fontWeight: 700 }}>{selection.channel.name}</div>
            <p
              style={{
                fontSize: 12,
                color: editorialChatTheme.onSurfaceVariant,
                lineHeight: 1.4,
              }}
            >
              {channelTopic}
            </p>
          </div>
          <Ed.StyledBentoGrid>
            <Ed.StyledBentoCell>
              <Ed.StyledBentoLabel>{t`Members`}</Ed.StyledBentoLabel>
              <Ed.StyledBentoValue>{groupChannel.memberCount}</Ed.StyledBentoValue>
            </Ed.StyledBentoCell>
            <Ed.StyledBentoCell>
              <Ed.StyledBentoLabel>{t`Pinned`}</Ed.StyledBentoLabel>
              <Ed.StyledBentoValue>{pinnedMessages.length}</Ed.StyledBentoValue>
            </Ed.StyledBentoCell>
          </Ed.StyledBentoGrid>
          {pinnedMessages.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <Ed.StyledBentoLabel style={{ marginBottom: 8 }}>
                {t`Pinned messages`}
              </Ed.StyledBentoLabel>
              {pinnedMessages.map((p) => (
                <div
                  key={p.messageId}
                  style={{
                    fontSize: 12,
                    padding: '8px 0',
                    borderBottom: `1px solid ${editorialChatTheme.outlineVariantGhost}`,
                  }}
                >
                  {p.preview}
                </div>
              ))}
            </div>
          ) : null}
          {mediaThumbs.length > 0 ? (
            <div>
              <Ed.StyledBentoLabel style={{ marginBottom: 8 }}>
                {t`Media`}
              </Ed.StyledBentoLabel>
              <Ed.StyledMediaGrid>
                {mediaThumbs.slice(0, 5).map((th) => (
                  <Ed.StyledMediaThumb
                    key={th.id}
                    type="button"
                    onClick={() => window.open(th.url, '_blank')}
                  >
                    <img alt={t`Attachment preview`} src={th.url} />
                  </Ed.StyledMediaThumb>
                ))}
              </Ed.StyledMediaGrid>
            </div>
          ) : null}
          <Ed.StyledDangerOutlineBtn type="button" onClick={onLeaveChannel}>
            {t`Leave channel`}
          </Ed.StyledDangerOutlineBtn>
        </>
      ) : selection?.kind === 'dm' && dmPeerMember ? (
        <>
          <div style={{ textAlign: 'center' }}>
            <Avatar
              avatarUrl={dmPeerMember.avatarUrl}
              placeholder={memberDisplayName(dmPeerMember)}
              placeholderColorSeed={dmPeerMember.streamUserId}
              size="xl"
            />
            <h3 style={{ margin: '12px 0 4px' }}>
              {memberDisplayName(dmPeerMember)}
            </h3>
            <p
              style={{
                fontSize: 11,
                color: editorialChatTheme.onSurfaceVariant,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}
            >
              {t`Direct message`}
            </p>
            <p
              style={{
                fontSize: 12,
                color: editorialChatTheme.onSurfaceVariant,
                marginTop: 12,
                lineHeight: 1.45,
              }}
            >
              {dmPeerMember.email}
            </p>
          </div>
        </>
      ) : (
        <p
          style={{ fontSize: 13, color: editorialChatTheme.onSurfaceVariant }}
        >
          {t`Select a channel or direct message to see context.`}
        </p>
      )}
    </Ed.StyledDetailsScroll>
  </Ed.StyledDetailsColumn>
);
