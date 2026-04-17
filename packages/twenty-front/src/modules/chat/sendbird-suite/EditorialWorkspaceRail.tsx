import { t } from '@lingui/core/macro';
import { Avatar, IconPlus, IconSearch, IconSparkles, IconUsers } from 'twenty-ui/display';
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
  /** Called when user clicks the KonnecctAI shortcut */
  onOpenAI: () => void;
  /** Whether the AI panel is currently open */
  isAIOpen: boolean;
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
  viewerFooterTitle: string;
  viewerAvatarPlaceholder: string;
  viewerAvatarPlaceholderSeed: string;
};

export const EditorialWorkspaceRail = ({
  workspaceTitle,
  planLabel,
  isWorkspaceAdmin,
  onOpenCreateChannel,
  onOpenNewDm,
  onOpenAI,
  isAIOpen,
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
  <Ed.StyledWorkspaceRail>
    <Ed.StyledRailHeader>
      <Ed.StyledRailBrandTitle>{workspaceTitle}</Ed.StyledRailBrandTitle>
      {planLabel ? <Ed.StyledRailBrandMeta>{planLabel}</Ed.StyledRailBrandMeta> : null}
    </Ed.StyledRailHeader>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '0 16px 12px' }}>
      {isWorkspaceAdmin ? (
        <Ed.StyledRailPrimaryCta type="button" onClick={onOpenCreateChannel}>
          <IconPlus size={18} /> {t`New channel`}
        </Ed.StyledRailPrimaryCta>
      ) : null}
      <Ed.StyledRailPrimaryCta
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
      </Ed.StyledRailPrimaryCta>
    </div>

    <Ed.StyledRailScroll>
      {/* ─── KonnecctAI shortcut — always first ─── */}
      <Ed.StyledAIRailButton
        type="button"
        $active={isAIOpen}
        onClick={onOpenAI}
        aria-label={t`Open KonnecctAI`}
      >
        <IconSparkles size={15} />
        <span style={{ flex: 1 }}>{t`KonnecctAI`}</span>
        {isAIOpen ? <Ed.StyledAIStreamingDot $visible={true} /> : null}
      </Ed.StyledAIRailButton>

      {/* ─── Search ─── */}
      <Ed.StyledRailNavRow
        type="button"
        onClick={() => {
          document
            .querySelector<HTMLInputElement>('#editorial-chat-search input')
            ?.focus();
        }}
      >
        <IconSearch size={16} /> {t`Search`}
      </Ed.StyledRailNavRow>
      <div style={{ padding: '0 8px 12px' }}>
        <div id="editorial-chat-search">
          <SearchInput
            placeholder={t`Search channels…`}
            value={search}
            onChange={onSearchChange}
          />
        </div>
      </div>

      {/* ─── Channels ─── */}
      {filteredCategories.map((cat) => (
        <div key={cat.id}>
          <Ed.StyledRailSectionLabel>{cat.name}</Ed.StyledRailSectionLabel>
          {cat.channels.map((ch) => (
            <Ed.StyledRailChannelRow
              key={ch.id}
              type="button"
              $active={selection?.kind === 'channel' && selection.channel.id === ch.id}
              onClick={() => onSelectChannel(ch)}
            >
              <span style={{ opacity: 0.5 }}>#</span>
              {ch.name}
            </Ed.StyledRailChannelRow>
          ))}
        </div>
      ))}

      {/* ─── DMs ─── */}
      <Ed.StyledRailSectionLabel>{t`Direct messages`}</Ed.StyledRailSectionLabel>
      {filteredDms.map((dm) => {
        const row = dmRowMeta(dm);
        return (
          <Ed.StyledRailChannelRow
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
          </Ed.StyledRailChannelRow>
        );
      })}
    </Ed.StyledRailScroll>

    <Ed.StyledRailFooter>
      <Ed.StyledRailUserRow>
        <Avatar
          avatarUrl={viewerAvatarUrl}
          placeholder={viewerAvatarPlaceholder}
          placeholderColorSeed={viewerAvatarPlaceholderSeed}
          size="sm"
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{viewerFooterTitle}</div>
          <div style={{ fontSize: 11, color: editorialChatTheme.onSurfaceVariant }}>
            {isWorkspaceAdmin ? t`Admin` : t`Member`}
          </div>
        </div>
      </Ed.StyledRailUserRow>
    </Ed.StyledRailFooter>
  </Ed.StyledWorkspaceRail>
);
