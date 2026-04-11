import { useMemo } from 'react';
import { styled } from '@linaria/react';
import { Callout } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { REACT_APP_MATTERMOST_WEBAPP_URL } from '~/config';

const StyledShell = styled.div`
  background: ${themeCssVariables.background.primary};
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  width: 100%;
`;

const StyledIframe = styled.iframe`
  border: none;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
`;

const StyledToolbar = styled.div`
  align-items: center;
  border-top: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex: 0 0 auto;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledFallback = styled.div`
  box-sizing: border-box;
  margin: 0 auto;
  max-width: 520px;
  padding: ${themeCssVariables.spacing[6]};
  width: 100%;
`;

/**
 * Embeds self-hosted Mattermost. The server must allow framing from the CRM
 * origin (Site URL, CSP, nginx X-Frame-Options). If the iframe stays blank,
 * use “Open in new tab”.
 */
export const MattermostChatEmbed = () => {
  const src = useMemo(() => {
    const raw = REACT_APP_MATTERMOST_WEBAPP_URL.trim();
    if (!raw) {
      return '';
    }
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  }, []);

  if (!src) {
    return (
      <StyledShell>
        <StyledFallback>
          <Callout
            variant="warning"
            title="Mattermost URL not configured"
            description="Set MATTERMOST_SITE_URL or REACT_APP_MATTERMOST_WEBAPP_URL on the API (e.g. https://projects.konnecct.com) and rebuild crm-server."
          />
        </StyledFallback>
      </StyledShell>
    );
  }

  return (
    <StyledShell>
      <StyledIframe
        allow="clipboard-read; clipboard-write; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        src={src}
        title="Team chat"
      />
      <StyledToolbar>
        <Button
          title="Open team chat in a new tab"
          variant="secondary"
          size="small"
          onClick={() => window.open(src, '_blank', 'noopener,noreferrer')}
        />
      </StyledToolbar>
    </StyledShell>
  );
};
