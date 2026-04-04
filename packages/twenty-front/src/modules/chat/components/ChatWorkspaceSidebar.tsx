import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { CreateChannelModal } from '@/chat/components/CreateChannelModal';
import { NewDmModal } from '@/chat/components/NewDmModal';
import { type ChatWorkspaceLayoutResponse } from '@/chat/types/chat-workspace-layout.type';

const StyledSidebar = styled.aside`
  display: flex;
  flex-direction: column;
  width: 272px;
  flex-shrink: 0;
  border-right: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.secondary};
  overflow: hidden;
  height: 100%;
`;

const StyledScroll = styled.div`
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: ${themeCssVariables.spacing[2]} 0;
`;

const StyledSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]} 0;
`;

const StyledSectionLabel = styled.div`
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
`;

const StyledCategoryHeader = styled.button`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  width: 100%;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  margin: 0 ${themeCssVariables.spacing[2]};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  background: transparent;
  cursor: pointer;
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  font-family: ${themeCssVariables.font.family};
  text-align: left;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledChevron = styled.span`
  display: inline-flex;
  width: 16px;
  justify-content: center;
  font-size: 10px;
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledChannelRow = styled.button<{ isSelected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  width: calc(100% - ${themeCssVariables.spacing[4]});
  margin: 0 ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  text-align: left;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  background: ${({ isSelected }) =>
    isSelected
      ? themeCssVariables.background.transparent.medium
      : 'transparent'};
  color: ${themeCssVariables.font.color.primary};

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledHash = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledDmRow = styled.button<{ isSelected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  width: calc(100% - ${themeCssVariables.spacing[4]});
  margin: 0 ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  text-align: left;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  background: ${({ isSelected }) =>
    isSelected
      ? themeCssVariables.background.transparent.medium
      : 'transparent'};
  color: ${themeCssVariables.font.color.primary};

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledPrivateBadge = styled.span`
  font-size: 10px;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  padding: 1px 6px;
  border-radius: 4px;
  background: ${themeCssVariables.background.transparent.medium};
  color: ${themeCssVariables.font.color.tertiary};
  text-transform: uppercase;
`;

type ChatWorkspaceSidebarProps = {
  layout: ChatWorkspaceLayoutResponse | null;
  selectedChannelId: string | null;
  selectedDmThreadId: string | null;
  authToken: string | undefined;
  onLayoutRefresh: () => void;
};

export const ChatWorkspaceSidebar = ({
  layout,
  selectedChannelId,
  selectedDmThreadId,
  authToken,
  onLayoutRefresh,
}: ChatWorkspaceSidebarProps) => {
  const navigate = useNavigate();
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<
    Record<string, boolean>
  >({});

  const toggleCategory = useCallback((categoryId: string) => {
    setCollapsedCategoryIds((previous) => ({
      ...previous,
      [categoryId]: !previous[categoryId],
    }));
  }, []);

  const openChannel = useCallback(
    (channelId: string) => {
      navigate(`/chat/c/${channelId}`);
    },
    [navigate],
  );

  const openDm = useCallback(
    (threadId: string) => {
      navigate(`/chat/dm/${threadId}`);
    },
    [navigate],
  );

  const handleChannelCreated = useCallback(
    (id: string) => {
      navigate(`/chat/c/${id}`);
    },
    [navigate],
  );

  const handleDmCreated = useCallback(
    (threadId: string) => {
      navigate(`/chat/dm/${threadId}`);
    },
    [navigate],
  );

  if (!layout) {
    return (
      <StyledSidebar>
        <StyledScroll />
      </StyledSidebar>
    );
  }

  return (
    <StyledSidebar>
      <CreateChannelModal
        isOpen={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        token={authToken}
        layout={layout}
        onCreated={handleChannelCreated}
        onLayoutRefresh={onLayoutRefresh}
      />
      <NewDmModal
        isOpen={newDmOpen}
        onClose={() => setNewDmOpen(false)}
        token={authToken}
        onCreated={handleDmCreated}
        onLayoutRefresh={onLayoutRefresh}
      />
      <StyledScroll>
        <StyledSectionHeader>
          <StyledSectionLabel style={{ paddingLeft: 0 }}>{t`Channels`}</StyledSectionLabel>
          <Button
            size="small"
            variant="secondary"
            title={t`New channel`}
            onClick={() => setCreateChannelOpen(true)}
          />
        </StyledSectionHeader>
        {layout.categories.map((category) => {
          const isCollapsed = collapsedCategoryIds[category.id] === true;

          return (
            <div key={category.id}>
              <StyledCategoryHeader
                type="button"
                onClick={() => toggleCategory(category.id)}
                aria-expanded={!isCollapsed}
              >
                <StyledChevron>{isCollapsed ? '▸' : '▾'}</StyledChevron>
                <span>{category.name}</span>
              </StyledCategoryHeader>
              {!isCollapsed &&
                category.channels.map((channel) => (
                  <StyledChannelRow
                    key={channel.id}
                    type="button"
                    isSelected={channel.id === selectedChannelId}
                    onClick={() => openChannel(channel.id)}
                  >
                    <StyledHash>#</StyledHash>
                    <span>{channel.name}</span>
                    {channel.visibility === 'private' && (
                      <StyledPrivateBadge>{t`Private`}</StyledPrivateBadge>
                    )}
                  </StyledChannelRow>
                ))}
            </div>
          );
        })}

        <StyledSectionHeader style={{ marginTop: 12 }}>
          <StyledSectionLabel style={{ paddingLeft: 0 }}>
            {t`Direct messages`}
          </StyledSectionLabel>
          <Button
            size="small"
            variant="secondary"
            title={t`New DM`}
            onClick={() => setNewDmOpen(true)}
          />
        </StyledSectionHeader>
        {layout.directThreads.length === 0 ? (
          <div
            style={{
              padding: `0 ${themeCssVariables.spacing[4]}`,
              fontSize: themeCssVariables.font.size.xs,
              color: themeCssVariables.font.color.tertiary,
              fontFamily: themeCssVariables.font.family,
            }}
          >
            {t`No direct messages yet`}
          </div>
        ) : (
          layout.directThreads.map((thread) => (
            <StyledDmRow
              key={thread.id}
              type="button"
              isSelected={thread.id === selectedDmThreadId}
              onClick={() => openDm(thread.id)}
            >
              {thread.title ?? t`Direct`}
            </StyledDmRow>
          ))
        )}
      </StyledScroll>
    </StyledSidebar>
  );
};
