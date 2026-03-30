import { useEffect, useRef } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useAtomValue } from 'jotai';
import { styled } from '@linaria/react';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { Section } from 'twenty-ui/layout';

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
`;

import { H2Title } from 'twenty-ui/display';

export const ChatModule = () => {
  const { t } = useLingui();
  const tokenPair = useAtomValue(tokenPairState.atom);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  console.log('Konnecct: V9 CHAT MODULE LOADED');
  
  const rocketChatUrl = (window as any)._env_?.ROCKET_CHAT_URL || window.location.origin + '/chat';
  const chatUrl = `${rocketChatUrl}/home?layout=embedded`;

  // Favicon Guard: Prevents the iframe from taking over the platform's favicon
  useEffect(() => {
    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (!favicon) return;

    const originalHref = favicon.href;
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'href') {
          if (favicon.href !== originalHref) {
            favicon.href = originalHref;
          }
        }
      }
    });

    observer.observe(favicon, { attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: verify the origin matches our Rocket.Chat instance domain
      const expectedOrigin = new URL(rocketChatUrl).origin;
      
      console.log('Konnecct: Received message from:', event.origin, 'Expected:', expectedOrigin, 'Event:', event.data?.event);

      if (event.origin !== expectedOrigin) return;

      if (event.data.event === 'get-logged-user-info' || event.data.event === 'iframe-ready') {
        const handleIframeLoad = () => {
          console.log('Konnecct: Iframe loaded, verifying auth...');
          
          if (currentToken) {
            // Delay to ensure the iframe internal scripts are ready to receive postMessage
            setTimeout(() => {
              console.log('Konnecct: Sending SSO handshake to Rocket.Chat');
              const iframe = document.getElementById('rocketchat-iframe') as HTMLIFrameElement;
              
              iframe?.contentWindow?.postMessage(
                {
                  event: 'login-with-token',
                  loginToken: currentToken,
                },
                '*'
              );
            }, 1000);
          } else {
            console.warn('Konnecct: Auth token missing, SSO handshake skipped.');
          }
        };
        handleIframeLoad();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [tokenPair, rocketChatUrl, currentToken]);

  return (
    <Section>
      <div style={{ padding: '16px 24px 8px' }}>
         <H2Title>{t`Chat`}</H2Title>
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
