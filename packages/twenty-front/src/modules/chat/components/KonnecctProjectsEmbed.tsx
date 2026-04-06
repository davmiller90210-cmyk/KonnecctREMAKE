import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { REACT_APP_PLANE_WEB_URL } from '~/config';

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

const StyledPlaceholder = styled.div`
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  padding: ${themeCssVariables.spacing[6]};
  color: ${themeCssVariables.font.color.tertiary};
  text-align: center;
`;

/**
 * Full Plane app in an iframe (separate host, e.g. projects.*), embedded in the CRM shell.
 */
export const KonnecctProjectsEmbed = () => {
  const { t } = useLingui();
  const planeUrl = REACT_APP_PLANE_WEB_URL.replace(/\/$/, '');

  if (!planeUrl) {
    return (
      <StyledShell>
        <StyledPlaceholder>
          {t`Set REACT_APP_PLANE_WEB_URL to your Plane web URL (e.g. https://projects.yourdomain.com).`}
        </StyledPlaceholder>
      </StyledShell>
    );
  }

  return (
    <StyledShell>
      <StyledIframe
        title={t`Konnecct Projects`}
        src={`${planeUrl}/`}
        allow="camera *; microphone *; display-capture *; fullscreen *"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-top-navigation-by-user-activation"
      />
    </StyledShell>
  );
};
