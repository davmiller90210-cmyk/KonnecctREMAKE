import { useAtomValue } from 'jotai';
import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { useMemo, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { CreateChannelModal } from '@/chat/components/CreateChannelModal';
import { NewDmModal } from '@/chat/components/NewDmModal';
import { useChatWorkspaceLayout } from '@/chat/hooks/useChatWorkspaceLayout';
import { chatUnreadMapState } from '@/chat/states/chatUnreadState';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';
import {
  IconLock,
  IconMessage,
  IconPlus,
  IconUsers,
  IconX,
  type IconComponent,
} from 'twenty-ui/display';
import { Button, LightIconButton } from 'twenty-ui/input';
import { NotificationCounter } from 'twenty-ui/navigation';
import { MOBILE_VIEWPORT, themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRoot = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
`;

const StyledSearchWrap = styled.div`
  flex-shrink: 0;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[2]}
    ${themeCssVariables.spacing[1]};
`;

const StyledSearchInput = styled.input`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  height: ${themeCssVariables.spacing[7]};
  outline: none;
  padding: 0 ${themeCssVariables.spacing[2]};
  width: 100%;

  &:focus {
    border-color: ${themeCssVariables.color.blue};
  }

  &::placeholder {
    color: ${themeCssVariables.font.color.tertiary};
  }
`;

const StyledScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding-bottom: ${themeCssVariables.spacing[2]};
`;

const StyledFooterActions = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
  border-top: 1px solid ${themeCssVariables.border.color.light};
`;

const StyledErrorText = styled.div`
  color: ${themeCssVariables.color.red};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledEmptyHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledMobileHeader = styled.div`
  align-items: center;
  display: none;
  flex-shrink: 0;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[2]};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    display: flex;
  }
`;

const StyledConvButton = styled.button<{ $active?: boolean }>`
  align-items: center;
  background: ${({ $active }) =>
    $active ? themeCssVariables.background.transparent.light : 'transparent'};
  border: 1px solid transparent;
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${({ $active }) =>
    $active
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.secondary};
  cursor: pointer;
  display: flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  margin: 0 ${themeCssVariables.spacing[2]};
  min-width: 0;
  padding: ${themeCssVariables.spacing[1]};
  text-align: left;
  width: calc(100% - ${themeCssVariables.spacing[4]});

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledConvLabel = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledIconWrap = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  margin-right: ${themeCssVariables.spacing[2]};
`;

type ChatConversationListPanelProps = {
  onMobileNavigate?: () => void;
};

const ConversationRow = ({
  label,
  Icon,
  active,
  unread,
  onClick,
}: {
  label: string;
  Icon: IconComponent;
  active: boolean;
  unread: number;
  onClick: () => void;
}) => (
  <StyledConvButton type="button" $active={active} onClick={onClick}>
    <StyledIconWrap>
      <Icon size={18} stroke={1.8} />
    </StyledIconWrap>
    <StyledConvLabel>{label}</StyledConvLabel>
    {unread > 0 ? <NotificationCounter count={unread} /> : null}
  </StyledConvButton>
);

export const ChatConversationListPanel = ({
  onMobileNavigate,
}: ChatConversationListPanelProps) => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { layout, error, reload } = useChatWorkspaceLayout();
  const unreadMap = useAtomValue(chatUnreadMapState.atom);
  const tokenPair = useAtomValue(tokenPairState.atom);
  const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  const channelMatch = useMatch('/chat/c/:channelId');
  const dmMatch = useMatch('/chat/dm/:dmThreadId');
  const activeChannelId = channelMatch?.params.channelId ?? null;
  const activeDmId = dmMatch?.params.dmThreadId ?? null;

  const [search, setSearch] = useState('');
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isNewDmOpen, setIsNewDmOpen] = useState(false);

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

  const unreadFor = (sendbirdChannelUrl: string | null) =>
    sendbirdChannelUrl ? (unreadMap[sendbirdChannelUrl] ?? 0) : 0;

  const handleNav = (path: string) => {
    navigate(path);
    onMobileNavigate?.();
  };

  return (
    <StyledRoot>
      <StyledMobileHeader>
        <span>{t`Conversations`}</span>
        {onMobileNavigate && (
          <LightIconButton
            Icon={IconX}
            accent="tertiary"
            size="small"
            aria-label={t`Close list`}
            onClick={onMobileNavigate}
          />
        )}
      </StyledMobileHeader>
      <StyledSearchWrap>
        <StyledSearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t`Search channels & DMs`}
        />
      </StyledSearchWrap>

      <StyledScroll>
        {error && (
          <StyledErrorText>
            {t`Couldn't load chat`}: {error}
          </StyledErrorText>
        )}

        {channelsByCategory.map((category) => (
          <NavigationDrawerSection key={category.id}>
            <NavigationDrawerSectionTitle
              label={category.name || t`Channels`}
              rightIcon={
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
            {category.channels.length === 0 ? (
              <StyledEmptyHint>{t`No channels`}</StyledEmptyHint>
            ) : (
              category.channels.map((channel) => (
                <ConversationRow
                  key={channel.id}
                  label={channel.name || channel.slug}
                  Icon={
                    channel.visibility === 'private' ? IconLock : IconMessage
                  }
                  active={activeChannelId === channel.id}
                  unread={unreadFor(channel.sendbirdChannelUrl)}
                  onClick={() => handleNav(`/chat/c/${channel.id}`)}
                />
              ))
            )}
          </NavigationDrawerSection>
        ))}

        <NavigationDrawerSection>
          <NavigationDrawerSectionTitle
            label={t`Direct messages`}
            rightIcon={
              <LightIconButton
                Icon={IconPlus}
                accent="tertiary"
                size="small"
                aria-label={t`Start a DM`}
                onClick={() => setIsNewDmOpen(true)}
              />
            }
          />
          {directThreads.length === 0 ? (
            <StyledEmptyHint>{t`No direct messages yet`}</StyledEmptyHint>
          ) : (
            directThreads.map((dm) => (
              <ConversationRow
                key={dm.id}
                label={dm.title ?? t`Direct message`}
                Icon={dm.kind === 'group' ? IconUsers : IconMessage}
                active={activeDmId === dm.id}
                unread={unreadFor(dm.sendbirdChannelUrl)}
                onClick={() => handleNav(`/chat/dm/${dm.id}`)}
              />
            ))
          )}
        </NavigationDrawerSection>
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
    </StyledRoot>
  );
};
