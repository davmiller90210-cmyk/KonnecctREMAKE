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
 * Rocket.Chat in an iframe. Default: same-origin `/communications/` (nginx → Rocket.Chat).
 * Set `REACT_APP_ROCKETCHAT_URL` to a dedicated host if subpath shows Rocket.Chat "Unknown path".
 */
export const RocketChatEmbed = () => {
  return (
    <StyledShell>
      <StyledIframe
        title="Rocket.Chat"
        src={getRocketChatIframeSrc()}
        allow="camera *; microphone *; display-capture *; fullscreen *"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-top-navigation-by-user-activation"
      />
    </StyledShell>
  );
};
