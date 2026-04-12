import { styled } from '@linaria/react';
import { lazy, Suspense } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { REACT_APP_CHAT_PROVIDER } from '~/config';
import { PageContentSkeletonLoader } from '~/loading/components/PageContentSkeletonLoader';

const MattermostHub = lazy(async () => {
  const m = await import('@/chat/components/MattermostHub');

  return { default: m.MattermostHub };
});

const CommunicationHub = lazy(async () => {
  const m = await import('@/chat/components/CommunicationHub');

  return { default: m.CommunicationHub };
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
          <MattermostHub />
        ) : (
          <CommunicationHub />
        )}
      </Suspense>
    </StyledChatPageRoot>
  );
};
