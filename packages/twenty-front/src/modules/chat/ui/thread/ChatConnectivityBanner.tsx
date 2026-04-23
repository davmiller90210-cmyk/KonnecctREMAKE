import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';

import { type ChatConnectivityStatus } from '@/chat/types/chat-connectivity.type';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledBar = styled.div<{ $variant: 'offline' | 'degraded' }>`
  align-items: center;
  background: ${({ $variant }) =>
    $variant === 'offline'
      ? themeCssVariables.background.transparent.danger
      : themeCssVariables.background.transparent.orange};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex-shrink: 0;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[3]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
`;

const StyledText = styled.span`
  flex: 1 1 auto;
  line-height: 1.35;
  min-width: 0;
`;

type ChatConnectivityBannerProps = {
  status: ChatConnectivityStatus;
  onRefresh: () => void;
};

export const ChatConnectivityBanner = ({
  status,
  onRefresh,
}: ChatConnectivityBannerProps) => {
  const { t } = useLingui();

  if (status === 'live') {
    return null;
  }

  const copy =
    status === 'offline'
      ? t`You're offline. Messages won't send until you're back online.`
      : t`Live updates paused. Your messages still sync periodically — refresh to catch up now.`;

  return (
    <StyledBar
      $variant={status === 'offline' ? 'offline' : 'degraded'}
      role="status"
    >
      <StyledText>{copy}</StyledText>
      <Button
        title={t`Refresh messages`}
        variant="secondary"
        size="small"
        onClick={onRefresh}
      />
    </StyledBar>
  );
};
