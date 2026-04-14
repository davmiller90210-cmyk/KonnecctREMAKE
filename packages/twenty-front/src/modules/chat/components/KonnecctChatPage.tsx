import { styled } from '@linaria/react';
import { lazy, Suspense } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { MattermostChatEmbed } from '@/chat/components/MattermostChatEmbed';
import {
  REACT_APP_CHAT_PROVIDER,
  REACT_APP_MATTERMOST_USE_NATIVE_HUB,
} from '~/config';
import { PageContentSkeletonLoader } from '~/loading/components/PageContentSkeletonLoader';

/**
 * Native Twenty-UI Mattermost client (REST + WS via crm-server PAT vault).
 * Requires Mattermost provisioning/admin token on the API; opt in with
 * REACT_APP_MATTERMOST_USE_NATIVE_HUB=true at build time.
 */
const MattermostHub = lazy(async () => {
  const m = await import('@/chat/components/MattermostHub');

  return { default: m.MattermostHub };
});

const CommunicationHub = lazy(async () => {
  const m = await import('@/chat/components/CommunicationHub');

  return { default: m.CommunicationHub };
});

const SendbirdCommunicationHub = lazy(async () => {
  const m = await import('@/chat/components/SendbirdCommunicationHub');

  return { default: m.SendbirdCommunicationHub };
});

/** Fills DefaultLayout main column (flex chain + min-height) for full-viewport chat. */
const StyledChatPageRoot = styled.div`
  background: ${themeCssVariables.background.noisy};
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  width: 100%;
`;

const ChatLoadingFallback = () => (
  <PageContentSkeletonLoader />
);

export const KonnecctChatPage = () => {
  return (
    <StyledChatPageRoot>
      <Suspense fallback={<ChatLoadingFallback />}>
        {REACT_APP_CHAT_PROVIDER === 'mattermost' ? (
          REACT_APP_MATTERMOST_USE_NATIVE_HUB ? (
            <MattermostHub />
          ) : (
            <MattermostChatEmbed />
          )
        ) : REACT_APP_CHAT_PROVIDER === 'sendbird' ? (
          <SendbirdCommunicationHub />
        ) : (
          <CommunicationHub />
        )}
      </Suspense>
    </StyledChatPageRoot>
  );
};
