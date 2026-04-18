import { useAtomValue } from 'jotai';
import { useLingui } from '@lingui/react/macro';
import { useMatch, useNavigate } from 'react-router-dom';
import { styled } from '@linaria/react';
import { useMemo, useState } from 'react';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { useChatWorkspaceLayout } from '@/chat/hooks/useChatWorkspaceLayout';
import { CreateChannelModal } from '@/chat/components/CreateChannelModal';
import { NewDmModal } from '@/chat/components/NewDmModal';
import { chatUnreadMapState } from '@/chat/states/chatUnreadState';
import { NavigationDrawer } from '@/ui/navigation/navigation-drawer/components/NavigationDrawer';
import { NavigationDrawerFixedContent } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerFixedContent';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { NavigationDrawerScrollableContent } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerScrollableContent';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';
import {
  IconHash,
  IconLock,
  IconMessageCircle,
  IconPlus,
  IconUsers,
} from 'twenty-ui/display';
import { Button, LightIconButton } from 'twenty-ui/input';
import { NotificationCounter } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledSearchWrap = styled.div`
  padding: 0 ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[1]};
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

const StyledFooterActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: 0 ${themeCssVariables.spacing[2]};
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

export const ChatNavigationDrawer = ({ className }: { className?: string }) => {
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

  return (
    <>
      <NavigationDrawer className={className} title={t`Exit Chat`}>
        <NavigationDrawerFixedContent>
          <StyledSearchWrap>
            <StyledSearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t`Search channels & DMs`}
            />
          </StyledSearchWrap>
        </NavigationDrawerFixedContent>

        <NavigationDrawerScrollableContent>
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
                category.channels.map((channel) => {
                  const unread = unreadFor(channel.sendbirdChannelUrl);
                  return (
                    <NavigationDrawerItem
                      key={channel.id}
                      label={channel.name || channel.slug}
                      to={`/chat/c/${channel.id}`}
                      Icon={
                        channel.visibility === 'private' ? IconLock : IconHash
                      }
                      active={activeChannelId === channel.id}
                      rightOptions={
                        unread > 0 ? (
                          <NotificationCounter count={unread} />
                        ) : undefined
                      }
                    />
                  );
                })
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
              directThreads.map((dm) => {
                const unread = unreadFor(dm.sendbirdChannelUrl);
                return (
                  <NavigationDrawerItem
                    key={dm.id}
                    label={dm.title ?? t`Direct message`}
                    to={`/chat/dm/${dm.id}`}
                    Icon={dm.kind === 'group' ? IconUsers : IconMessageCircle}
                    active={activeDmId === dm.id}
                    rightOptions={
                      unread > 0 ? (
                        <NotificationCounter count={unread} />
                      ) : undefined
                    }
                  />
                );
              })
            )}
          </NavigationDrawerSection>
        </NavigationDrawerScrollableContent>

        <NavigationDrawerFixedContent>
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
        </NavigationDrawerFixedContent>
      </NavigationDrawer>

      {isCreateChannelOpen && (
        <CreateChannelModal
          isOpen
          onClose={() => setIsCreateChannelOpen(false)}
          token={token}
          layout={layout}
          onCreated={(channelId) => {
            setIsCreateChannelOpen(false);
            navigate(`/chat/c/${channelId}`);
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
            navigate(`/chat/dm/${threadId}`);
          }}
          onLayoutRefresh={() => {
            void reload();
          }}
        />
      )}
    </>
  );
};
