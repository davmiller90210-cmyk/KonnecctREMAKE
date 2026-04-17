import { lazy, Suspense } from 'react';
import { styled } from '@linaria/react';
import { editorialChatTheme } from '@/chat/theme/editorialChatTheme';
import { PageContentSkeletonLoader } from '~/loading/components/PageContentSkeletonLoader';

const SendbirdCommunicationHub = lazy(
  () => import('@/chat/components/SendbirdCommunicationHub'),
);

/**
 * Fills layout main column (flex chain + min-height) for full-viewport chat.
 * Background uses the Sendbird editorial surface token for theme consistency.
 */
const StyledChatPageRoot = styled.div`
  background: ${editorialChatTheme.surface};
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  width: 100%;
`;

export const KonnecctChatPage = () => (
  <StyledChatPageRoot>
    <Suspense fallback={<PageContentSkeletonLoader />}>
      <SendbirdCommunicationHub />
    </Suspense>
  </StyledChatPageRoot>
);
