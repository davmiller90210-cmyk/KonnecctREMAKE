import { REACT_APP_ROCKETCHAT_URL } from '~/config';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const getRocketChatIframeSrc = (): string => {
  const raw = REACT_APP_ROCKETCHAT_URL?.trim();
  if (raw) {
    return raw.endsWith('/') ? raw : `${raw}/`;
  }
  return `${window.location.origin}/communications/`;
};

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
 * Full-viewport chat embedded at same origin as the CRM (`/communications/`) so the address bar stays `app.*`.
 * Optional override: `REACT_APP_ROCKETCHAT_URL` (e.g. debugging). In Rocket.Chat Admin: set workspace name/logo,
 * Layout → Custom CSS to tone down vendor chrome if your license allows.
 */
export const RocketChatEmbed = () => {
  return (
    <StyledShell>
      <StyledIframe
        title="Communications"
        src={getRocketChatIframeSrc()}
        allow="camera *; microphone *; display-capture *; fullscreen *"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-top-navigation-by-user-activation"
      />
    </StyledShell>
  );
};
