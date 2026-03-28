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

export const ChatModule = () => {
  const { t } = useLingui();
  const tokenPair = useAtomValue(tokenPairState.atom);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const rocketChatUrl = (window as any).CONFIG?.ROCKET_CHAT_URL || 'http://localhost:3000';
  const chatUrl = `${rocketChatUrl}/home?layout=embedded`;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: verify the origin matches our Rocket.Chat instance
      if (!event.origin.startsWith(rocketChatUrl)) return;

      if (event.data.event === 'get-logged-user-info') {
        const token = tokenPair?.accessToken;
        if (token) {
          iframeRef.current?.contentWindow?.postMessage({
            event: 'login-with-token',
            loginToken: token
          }, rocketChatUrl);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [tokenPair, rocketChatUrl]);

  return (
    <Section title={t`Chat`}>
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
