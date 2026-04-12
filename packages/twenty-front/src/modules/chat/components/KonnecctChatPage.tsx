import { CommunicationHub } from '@/chat/components/CommunicationHub';
import { MattermostHub } from '@/chat/components/MattermostHub';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { REACT_APP_CHAT_PROVIDER } from '~/config';

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

export const KonnecctChatPage = () => {
  return (
    <StyledChatPageRoot>
      {REACT_APP_CHAT_PROVIDER === 'mattermost' ? (
        <MattermostHub />
      ) : (
        <CommunicationHub />
      )}
    </StyledChatPageRoot>
  );
};
