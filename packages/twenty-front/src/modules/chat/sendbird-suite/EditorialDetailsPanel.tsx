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
  <Ed.DetailsColumn>
    <Ed.DetailsHeader>
      <Ed.DetailsTitle>{t`Details`}</Ed.DetailsTitle>
    </Ed.DetailsHeader>
    <Ed.DetailsScroll>
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
          <Ed.BentoGrid>
            <Ed.BentoCell>
              <Ed.BentoLabel>{t`Members`}</Ed.BentoLabel>
              <Ed.BentoValue>{groupChannel.memberCount}</Ed.BentoValue>
            </Ed.BentoCell>
            <Ed.BentoCell>
              <Ed.BentoLabel>{t`Pinned`}</Ed.BentoLabel>
              <Ed.BentoValue>{pinnedMessages.length}</Ed.BentoValue>
            </Ed.BentoCell>
          </Ed.BentoGrid>
          {pinnedMessages.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <Ed.BentoLabel style={{ marginBottom: 8 }}>
                {t`Pinned messages`}
              </Ed.BentoLabel>
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
              <Ed.BentoLabel style={{ marginBottom: 8 }}>
                {t`Media`}
              </Ed.BentoLabel>
              <Ed.MediaGrid>
                {mediaThumbs.slice(0, 5).map((th) => (
                  <Ed.MediaThumb
                    key={th.id}
                    type="button"
                    onClick={() => window.open(th.url, '_blank')}
                  >
                    <img alt={t`Attachment preview`} src={th.url} />
                  </Ed.MediaThumb>
                ))}
              </Ed.MediaGrid>
            </div>
          ) : null}
          <Ed.DangerOutlineBtn type="button" onClick={onLeaveChannel}>
            {t`Leave channel`}
          </Ed.DangerOutlineBtn>
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
    </Ed.DetailsScroll>
  </Ed.DetailsColumn>
);
