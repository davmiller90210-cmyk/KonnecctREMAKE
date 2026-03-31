import { useEffect, useRef } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useAtomValue } from 'jotai';
import { styled } from '@linaria/react';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { Section } from 'twenty-ui/layout';
import { H2Title } from 'twenty-ui/display';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const StyledIframe = styled.iframe`
  border: none;
  flex: 1;
  height: 100%;
  width: 100%;
  opacity: 1;
  visibility: visible;
`;

export const ChatView = () => {
  const { t } = useLingui();
  const tokenPair = useAtomValue(tokenPairState.atom);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Use atom value OR fallback to direct localStorage for reliability
  const currentToken = tokenPair?.accessToken || localStorage.getItem('token') || '';
  
  // V40: Pointing to /rc-proxy/ to bypass the SPA router's /chat interception
  const rocketChatUrl = window.location.origin + '/rc-proxy/';
  const chatUrl = `${rocketChatUrl}home?layout=embedded`;

  useEffect(() => {
    console.log('Konnecct: ChatView Mounted');
    console.log('Konnecct: Auth State:', { fromAtom: !!tokenPair?.accessToken, fromStorage: !!localStorage.getItem('token') });
  }, [tokenPair]);

  // Favicon Guard
  useEffect(() => {
    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (!favicon) return;
    const originalHref = favicon.href;
    const observer = new MutationObserver(() => {
      if (favicon.href !== originalHref) favicon.href = originalHref;
    });
    observer.observe(favicon, { attributes: true });
    return () => observer.disconnect();
  }, []);

  // SSO Handshake logic
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const expectedOrigin = new URL(rocketChatUrl).origin;
      
      if (event.origin !== expectedOrigin) return;

      // Rocket.Chat says it's ready, or asks for user info
      if (event.data.event === 'get-logged-user-info' || event.data.event === 'iframe-ready') {
        if (currentToken) {
          console.log('Konnecct: Sending SSO Handshake...');
          iframeRef.current?.contentWindow?.postMessage({
            event: 'login-with-token',
            loginToken: currentToken
          }, expectedOrigin);
        } else {
          console.warn('Konnecct: No auth token found. SSO handshake skipped.');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [rocketChatUrl, currentToken]);

  return (
    <Section>
      <div style={{ padding: '16px 24px 8px' }}>
         <H2Title title={t`Chat`} />
      </div>
      <StyledContainer>
        <StyledIframe
          ref={iframeRef}
          title={t`Chat`}
          src={chatUrl}
          allow="camera;microphone;clipboard-read;clipboard-write;fullscreen"
        />
      </StyledContainer>
    </Section>
  );
};
