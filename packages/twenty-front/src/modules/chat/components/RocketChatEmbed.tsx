import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledShell = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  width: 100%;
  min-height: 0;
  height: 100%;
  background: ${themeCssVariables.background.primary};
`;

const StyledIframe = styled.iframe`
  border: none;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
`;

/**
 * Same-origin iframe to Rocket.Chat (nginx proxies `/communications/` → Rocket.Chat).
 * Trailing slash avoids clashing with the SPA route `/communications` (no slash).
 */
export const RocketChatEmbed = () => {
  return (
    <StyledShell>
      <StyledIframe
        title="Rocket.Chat"
        src={`${window.location.origin}/communications/`}
        allow="camera *; microphone *; display-capture *; fullscreen *"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-top-navigation-by-user-activation"
      />
    </StyledShell>
  );
};
