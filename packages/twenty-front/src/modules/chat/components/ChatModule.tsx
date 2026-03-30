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
      if (event.origin !== expectedOrigin) return;

      console.log('Konnecct: Received iframe message:', event.data.event);

      if (event.data.event === 'get-logged-user-info' || event.data.event === 'iframe-ready') {
        const token = tokenPair?.accessToken;
        console.log('Konnecct: Attempting SSO login with token status:', !!token);
        
        if (token) {
          // Add a small delay to ensure Rocket.Chat's internal Meteor is ready for the login call
          setTimeout(() => {
            console.log('Konnecct: Sending login-with-token to Rocket.Chat');
            iframeRef.current?.contentWindow?.postMessage({
              event: 'login-with-token',
              loginToken: token
            }, expectedOrigin);
          }, 500);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [tokenPair, rocketChatUrl]);

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
