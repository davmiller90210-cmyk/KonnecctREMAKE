import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { IconBell } from 'twenty-ui/display';
import { LightIconButton } from 'twenty-ui/input';
import { NotificationCounter } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';

type ChatNotificationRow = {
  id: string;
  conversationKind: 'channel' | 'dm';
  conversationId: string;
  bodyPreview: string;
  readAt: string | null;
  createdAt: string;
};

const StyledWrap = styled.div`
  display: inline-flex;
  position: relative;
`;

const StyledBadgeAnchor = styled.div`
  pointer-events: none;
  position: absolute;
  right: -6px;
  top: -6px;
`;

const StyledPanel = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  max-height: min(420px, 70vh);
  overflow: auto;
  position: absolute;
  right: 0;
  top: calc(100% + ${themeCssVariables.spacing[2]});
  width: min(360px, 92vw);
  z-index: 20;
`;

const StyledPanelHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: 600;
`;

const StyledMarkAll = styled.button`
  background: none;
  border: none;
  color: ${themeCssVariables.color.blue};
  cursor: pointer;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[1]};

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;

const StyledList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const StyledItem = styled.li<{ $unread: boolean }>`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  cursor: pointer;
  padding: ${themeCssVariables.spacing[3]};
  background: ${({ $unread }) =>
    $unread ? themeCssVariables.background.transparent.lighter : 'transparent'};

  &:hover {
    background: ${themeCssVariables.background.transparent.medium};
  }
`;

const StyledPreview = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  margin-top: ${themeCssVariables.spacing[1]};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledMeta = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[6]};
  text-align: center;
`;

type ChatInAppNotificationsPopoverProps = {
  token: string | undefined;
  unreadCount: number;
  onChanged?: () => void;
};

export const ChatInAppNotificationsPopover = ({
  token,
  unreadCount,
  onChanged,
}: ChatInAppNotificationsPopoverProps) => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChatNotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch('/chat/notifications?limit=40', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error('notifications');
      }
      const data = (await response.json()) as {
        notifications: ChatNotificationRow[];
      };
      setItems(data.notifications ?? []);
    } catch {
      setItems([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [load, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const node = wrapRef.current;

      if (node && !node.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const markReadIds = async (ids: string[]) => {
    if (!token || ids.length === 0) {
      return;
    }
    await fetch('/chat/notifications/read', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
    onChanged?.();
  };

  const handleMarkAll = async () => {
    if (!token) {
      return;
    }
    await fetch('/chat/notifications/read-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    setOpen(false);
    onChanged?.();
  };

  const handleOpenItem = async (row: ChatNotificationRow) => {
    if (!token) {
      return;
    }
    if (!row.readAt) {
      await markReadIds([row.id]);
    }
    setOpen(false);
    if (row.conversationKind === 'channel') {
      navigate(`/chat/c/${row.conversationId}`);
    } else {
      navigate(`/chat/dm/${row.conversationId}`);
    }
  };

  const hasUnreadInList = items.some((row) => !row.readAt);

  return (
    <StyledWrap ref={wrapRef}>
      <LightIconButton
        Icon={IconBell}
        accent="tertiary"
        size="medium"
        aria-label={t`Chat notifications`}
        onClick={() => setOpen((value) => !value)}
        testId="chat-in-app-notifications"
      />
      {unreadCount > 0 ? (
        <StyledBadgeAnchor>
          <NotificationCounter count={unreadCount} />
        </StyledBadgeAnchor>
      ) : null}
      {open ? (
        <StyledPanel role="dialog" aria-label={t`Notifications`}>
          <StyledPanelHeader>
            <StyledTitle>{t`Notifications`}</StyledTitle>
            <StyledMarkAll
              type="button"
              onClick={() => void handleMarkAll()}
              disabled={
                loading || (!hasUnreadInList && unreadCount === 0)
              }
            >
              {t`Mark all read`}
            </StyledMarkAll>
          </StyledPanelHeader>
          {loading ? (
            <StyledEmpty>{t`Loading…`}</StyledEmpty>
          ) : loadError ? (
            <StyledEmpty>{t`Could not load notifications.`}</StyledEmpty>
          ) : items.length === 0 ? (
            <StyledEmpty>{t`No notifications yet.`}</StyledEmpty>
          ) : (
            <StyledList>
              {items.map((row) => (
                <StyledItem
                  key={row.id}
                  $unread={!row.readAt}
                  onClick={() => void handleOpenItem(row)}
                >
                  <StyledMeta>
                    {row.conversationKind === 'channel'
                      ? t`Channel`
                      : t`Direct message`}
                  </StyledMeta>
                  <StyledPreview>{row.bodyPreview}</StyledPreview>
                </StyledItem>
              ))}
            </StyledList>
          )}
        </StyledPanel>
      ) : null}
    </StyledWrap>
  );
};
