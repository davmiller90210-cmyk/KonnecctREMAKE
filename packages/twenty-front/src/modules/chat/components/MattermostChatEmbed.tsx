import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { styled } from '@linaria/react';
import { AppPath } from 'twenty-shared/types';
import {
  Callout,
  IconArrowLeft,
  IconExternalLink,
  IconLogin2,
} from 'twenty-ui/display';
import { IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import {
  REACT_APP_MATTERMOST_SSO_ENTRY_PATH,
  REACT_APP_MATTERMOST_WEBAPP_URL,
} from '~/config';

const StyledShell = styled.div`
  background: ${themeCssVariables.background.noisy};
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  width: 100%;
`;

const StyledHeader = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex: 0 0 auto;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  min-height: 44px;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledHeaderLeft = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  min-width: 0;
`;

const StyledHeaderActions = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: 600;
`;

const StyledIframe = styled.iframe`
  background: ${themeCssVariables.background.primary};
  border: none;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
`;

const StyledFallback = styled.div`
  box-sizing: border-box;
  margin: 0 auto;
  max-width: 520px;
  padding: ${themeCssVariables.spacing[6]};
  width: 100%;
`;

const StyledBackLink = styled(Link)`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  text-decoration: none;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }
`;

/**
 * Embeds self-hosted Mattermost (dedicated chat host). Skinned on the server via
 * nginx-injected CSS; cannot be true Twenty UI without replacing the MM client.
 */
export const MattermostChatEmbed = () => {
  const src = useMemo(() => {
    const raw = REACT_APP_MATTERMOST_WEBAPP_URL.trim();
    if (!raw) {
      return '';
    }
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  }, []);

  const [iframeKey, setIframeKey] = useState(0);
  const popupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (popupPollRef.current !== null) {
        clearInterval(popupPollRef.current);
      }
    };
  }, []);

  const ssoEntryUrl = useMemo(() => {
    if (!src) {
      return '';
    }
    const path = REACT_APP_MATTERMOST_SSO_ENTRY_PATH.startsWith('/')
      ? REACT_APP_MATTERMOST_SSO_ENTRY_PATH
      : `/${REACT_APP_MATTERMOST_SSO_ENTRY_PATH}`;
    return `${src}${path}`;
  }, [src]);

  const openSsoHandoff = useCallback(() => {
    if (!ssoEntryUrl) {
      return;
    }
    if (popupPollRef.current !== null) {
      clearInterval(popupPollRef.current);
      popupPollRef.current = null;
    }
    const features =
      'popup=yes,width=520,height=720,left=80,top=80,scrollbars=yes,resizable=yes';
    const popup = window.open(ssoEntryUrl, 'konnecct_mattermost_sso', features);
    if (!popup) {
      window.open(ssoEntryUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    popupPollRef.current = setInterval(() => {
      if (popup.closed) {
        if (popupPollRef.current !== null) {
          clearInterval(popupPollRef.current);
          popupPollRef.current = null;
        }
        setIframeKey((k) => k + 1);
      }
    }, 500);
  }, [ssoEntryUrl]);

  if (!src) {
    return (
      <StyledShell>
        <StyledFallback>
          <Callout
            variant="warning"
            title="Mattermost URL not configured"
            description="Set MATTERMOST_SITE_URL or REACT_APP_MATTERMOST_WEBAPP_URL on the API (dedicated chat host, e.g. https://chat.konnecct.com) and rebuild crm-server."
          />
        </StyledFallback>
      </StyledShell>
    );
  }

  return (
    <StyledShell>
      <StyledHeader>
        <StyledHeaderLeft>
          <StyledBackLink to={AppPath.Index} title="Back to workspace">
            <IconArrowLeft size={16} />
            Workspace
          </StyledBackLink>
          <StyledTitle>Chat</StyledTitle>
        </StyledHeaderLeft>
        <StyledHeaderActions>
          <IconButton
            Icon={IconExternalLink}
            variant="tertiary"
            size="small"
            ariaLabel="Open chat in new tab"
            title="Open in new tab"
            onClick={() => window.open(src, '_blank', 'noopener,noreferrer')}
          />
          <IconButton
            Icon={IconLogin2}
            variant="tertiary"
            size="small"
            ariaLabel="Sign in to chat in a popup if the iframe session fails"
            title="Sign-in popup"
            onClick={openSsoHandoff}
          />
        </StyledHeaderActions>
      </StyledHeader>
      <StyledIframe
        key={iframeKey}
        allow="clipboard-read; clipboard-write; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        src={src}
        title="Chat"
      />
    </StyledShell>
  );
};
