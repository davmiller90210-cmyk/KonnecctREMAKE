import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { useAtomValue } from 'jotai';
import { useLocation } from 'react-router-dom';

import { chatTotalUnreadState } from '@/chat/states/chatUnreadState';
import { ChatConversationListBody } from '@/chat/components/ChatConversationListBody';
import { CommunicationsSectionHeader } from '@/navigation/components/CommunicationsSectionHeader';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { useNavigationSection } from '@/ui/navigation/navigation-drawer/hooks/useNavigationSection';
import { NotificationCounter } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const COMMUNICATIONS_NAV_SECTION_ID = 'CommunicationsChat';

/**
 * Gradient border + frosted inner panel (glass-style, similar to uiverse / reactbits card patterns).
 */
const StyledGlassOuter = styled.div`
  background: linear-gradient(
    135deg,
    ${themeCssVariables.color.blue},
    ${themeCssVariables.color.sky} 45%,
    ${themeCssVariables.color.blue3} 100%
  );
  border-radius: ${themeCssVariables.border.radius.lg};
  box-shadow:
    0 1px 0 ${themeCssVariables.background.transparent.light} inset,
    ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  margin: 0 ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  min-height: 0;
  padding: 1px;
  position: relative;
`;

const StyledGlassInner = styled.div`
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  background: linear-gradient(
    165deg,
    ${themeCssVariables.background.secondary} 0%,
    ${themeCssVariables.background.primary} 100%
  );
  border-radius: calc(${themeCssVariables.border.radius.lg} - 1px);
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  position: relative;

  &::after {
    background: radial-gradient(
      120% 80% at 10% 0%,
      ${themeCssVariables.background.transparent.blue},
      transparent 55%
    );
    content: '';
    inset: 0;
    opacity: 0.45;
    pointer-events: none;
    position: absolute;
  }
`;

const StyledBodyClip = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  max-height: min(46vh, 400px);
  min-height: 0;
  overflow: hidden;
  position: relative;
  z-index: 1;
`;

const StyledBodyInner = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
  scrollbar-color: ${themeCssVariables.border.color.medium} transparent;
  scrollbar-width: thin;
`;

export const CommunicationsNavigationSection = () => {
  const { t } = useLingui();
  const location = useLocation();
  const chatTotalUnread = useAtomValue(chatTotalUnreadState);
  const showChatUnread =
    chatTotalUnread > 0 && !location.pathname.startsWith('/chat');

  const { toggleNavigationSection, isNavigationSectionOpen } =
    useNavigationSection(COMMUNICATIONS_NAV_SECTION_ID);

  return (
    <NavigationDrawerSection>
      <CommunicationsSectionHeader
        isOpen={isNavigationSectionOpen}
        onToggle={() => toggleNavigationSection()}
        rightIcon={
          showChatUnread ? (
            <NotificationCounter count={chatTotalUnread} />
          ) : undefined
        }
      />
      {isNavigationSectionOpen ? (
        <StyledGlassOuter aria-label={t`Communications panel`}>
          <StyledGlassInner>
            <StyledBodyClip>
              <StyledBodyInner>
                <ChatConversationListBody variant="navigationDrawer" />
              </StyledBodyInner>
            </StyledBodyClip>
          </StyledGlassInner>
        </StyledGlassOuter>
      ) : null}
    </NavigationDrawerSection>
  );
};
