import { t } from '@lingui/core/macro';
import { Avatar, IconPlus, IconSearch, IconUsers } from 'twenty-ui/display';
import { SearchInput } from 'twenty-ui/input';

import { editorialChatTheme } from '@/chat/theme/editorialChatTheme';
import type {
  ChatHubSelection,
  ChatWorkspaceLayoutCategory,
  ChatWorkspaceLayoutChannel,
  ChatWorkspaceLayoutDm,
} from '@/chat/types/chat-workspace-layout.type';
import * as Ed from './editorialLayout';

export type EditorialWorkspaceRailProps = {
  workspaceTitle: string;
  planLabel: string | null;
  isWorkspaceAdmin: boolean;
  onOpenCreateChannel: () => void;
  onOpenNewDm: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  filteredCategories: ChatWorkspaceLayoutCategory[];
  filteredDms: ChatWorkspaceLayoutDm[];
  selection: ChatHubSelection | null;
  onSelectChannel: (channel: ChatWorkspaceLayoutChannel) => void;
  onSelectDm: (dm: ChatWorkspaceLayoutDm) => void;
  dmRowMeta: (dm: ChatWorkspaceLayoutDm) => {
    avatarUrl: string | null;
    label: string;
  };
  viewerAvatarUrl: string | null;
  /** Shown next to the avatar in the rail footer. */
  viewerFooterTitle: string;
  /** Placeholder initials when no avatar image is available. */
  viewerAvatarPlaceholder: string;
  viewerAvatarPlaceholderSeed: string;
};

export const EditorialWorkspaceRail = ({
  workspaceTitle,
  planLabel,
  isWorkspaceAdmin,
  onOpenCreateChannel,
  onOpenNewDm,
  search,
  onSearchChange,
  filteredCategories,
  filteredDms,
  selection,
  onSelectChannel,
  onSelectDm,
  dmRowMeta,
  viewerAvatarUrl,
  viewerFooterTitle,
  viewerAvatarPlaceholder,
  viewerAvatarPlaceholderSeed,
}: EditorialWorkspaceRailProps) => (
  <Ed.WorkspaceRail>
    <Ed.RailHeader>
      <Ed.RailBrandTitle>{workspaceTitle}</Ed.RailBrandTitle>
      {planLabel ? <Ed.RailBrandMeta>{planLabel}</Ed.RailBrandMeta> : null}
    </Ed.RailHeader>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        margin: '0 16px 12px',
      }}
    >
      {isWorkspaceAdmin ? (
        <Ed.RailPrimaryCta type="button" onClick={onOpenCreateChannel}>
          <IconPlus size={18} /> {t`New channel`}
        </Ed.RailPrimaryCta>
      ) : null}
      <Ed.RailPrimaryCta
        type="button"
        onClick={onOpenNewDm}
        style={
          isWorkspaceAdmin
            ? {
                background: 'transparent',
                border: `1px solid ${editorialChatTheme.primaryMutedBorder}`,
                color: editorialChatTheme.primary,
              }
            : undefined
        }
      >
        <IconUsers size={18} /> {t`New direct message`}
      </Ed.RailPrimaryCta>
    </div>
    <Ed.RailScroll>
      <Ed.RailNavRow
        type="button"
        onClick={() => {
          document
            .querySelector<HTMLInputElement>('#editorial-chat-search input')
            ?.focus();
        }}
      >
        <IconSearch size={16} /> {t`Search`}
      </Ed.RailNavRow>
      <div style={{ padding: '0 8px 12px' }}>
        <div id="editorial-chat-search">
          <SearchInput
            placeholder={t`Search channels…`}
            value={search}
            onChange={onSearchChange}
          />
        </div>
      </div>
      {filteredCategories.map((cat) => (
        <div key={cat.id}>
          <Ed.RailSectionLabel>{cat.name}</Ed.RailSectionLabel>
          {cat.channels.map((ch) => (
            <Ed.RailChannelRow
              key={ch.id}
              type="button"
              $active={
                selection?.kind === 'channel' && selection.channel.id === ch.id
              }
              onClick={() => onSelectChannel(ch)}
            >
              <span style={{ opacity: 0.5 }}>#</span>
              {ch.name}
            </Ed.RailChannelRow>
          ))}
        </div>
      ))}
      <Ed.RailSectionLabel>{t`Direct messages`}</Ed.RailSectionLabel>
      {filteredDms.map((dm) => {
        const row = dmRowMeta(dm);
        return (
          <Ed.RailChannelRow
            key={dm.id}
            type="button"
            $active={selection?.kind === 'dm' && selection.dm.id === dm.id}
            onClick={() => onSelectDm(dm)}
          >
            <Avatar
              avatarUrl={row.avatarUrl}
              placeholder={row.label}
              placeholderColorSeed={dm.id}
              size="sm"
            />
            {row.label}
          </Ed.RailChannelRow>
        );
      })}
    </Ed.RailScroll>
    <Ed.RailFooter>
      <Ed.RailUserRow>
        <Avatar
          avatarUrl={viewerAvatarUrl}
          placeholder={viewerAvatarPlaceholder}
          placeholderColorSeed={viewerAvatarPlaceholderSeed}
          size="sm"
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {viewerFooterTitle}
          </div>
          <div
            style={{ fontSize: 11, color: editorialChatTheme.onSurfaceVariant }}
          >
            {isWorkspaceAdmin ? t`Admin` : t`Member`}
          </div>
        </div>
      </Ed.RailUserRow>
    </Ed.RailFooter>
  </Ed.WorkspaceRail>
);
