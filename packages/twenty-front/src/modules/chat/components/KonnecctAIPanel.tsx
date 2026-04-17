import { useEffect, useRef } from 'react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { IconX, IconSparkles } from 'twenty-ui/display';
import { IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { AgentChatProvider } from '@/ai/components/AgentChatProvider';
import { AIChatTab } from '@/ai/components/AIChatTab';
import { AGENT_CHAT_SEND_MESSAGE_EVENT_NAME } from '@/ai/constants/AgentChatSendMessageEventName';
import { agentChatInputState } from '@/ai/states/agentChatInputState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import {
  useKonnecctAIPanel,
} from '@/chat/contexts/KonnecctAIPanelContext';

// ─── Styled Components ────────────────────────────────────────────────────────

/**
 * Outer shell — slides in from the right. Uses CSS transform + opacity
 * for GPU-composited animation (no layout reflow).
 */
const StyledPanelShell = styled.div<{ $open: boolean }>`
  background: ${themeCssVariables.background.primary};
  border-left: 1px solid ${themeCssVariables.border.color.medium};
  box-shadow: ${({ $open }) =>
    $open ? '-8px 0 40px rgba(0,0,0,0.18)' : 'none'};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  overflow: hidden;
  pointer-events: ${({ $open }) => ($open ? 'auto' : 'none')};
  transform: ${({ $open }) => ($open ? 'translateX(0)' : 'translateX(24px)')};
  transition:
    width 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.18s ease,
    transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  width: ${({ $open }) => ($open ? '360px' : '0')};

  @media (max-width: 1100px) {
    width: ${({ $open }) => ($open ? '320px' : '0')};
  }
`;

const StyledHeader = styled.header`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  height: 48px;
  padding: 0 ${themeCssVariables.spacing[3]};
`;

/**
 * Gradient brand mark — "KonnecctAI" wordmark with animated shimmer while streaming.
 */
const StyledBrandmark = styled.div`
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const StyledSparkleWrap = styled.span`
  align-items: center;
  background: linear-gradient(
    135deg,
    ${themeCssVariables.color.blue} 0%,
    ${themeCssVariables.color.purple} 100%
  );
  border-radius: ${themeCssVariables.border.radius.sm};
  color: #fff;
  display: inline-flex;
  flex-shrink: 0;
  padding: 3px;
`;

const StyledBrandName = styled.span`
  background: linear-gradient(
    90deg,
    ${themeCssVariables.color.blue} 0%,
    ${themeCssVariables.color.purple} 80%
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: -0.01em;
`;

const StyledContextBadge = styled.div`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: 10px;
  font-weight: ${themeCssVariables.font.weight.medium};
  letter-spacing: 0.02em;
  overflow: hidden;
  padding: 2px 7px;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
`;

const StyledBody = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
`;

// ─── Inner Component (needs AgentChatProvider wrapping) ──────────────────────

const KonnecctAIPanelInner = () => {
  const { pendingQuery, clearPendingQuery, close, channelContext } =
    useKonnecctAIPanel();
  const setInput = useSetAtomState(agentChatInputState);
  const injectedRef = useRef(false);

  // Inject pending query exactly once when panel opens with a pre-seeded question
  useEffect(() => {
    if (pendingQuery && !injectedRef.current) {
      injectedRef.current = true;
      setInput(pendingQuery);
      clearPendingQuery();

      // Auto-send after a microtask to let the composer mount
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(AGENT_CHAT_SEND_MESSAGE_EVENT_NAME));
      }, 80);
    }

    if (!pendingQuery) {
      injectedRef.current = false;
    }
  }, [pendingQuery, setInput, clearPendingQuery]);

  const contextLabel = channelContext?.channelName
    ? `Context: ${channelContext.kind === 'channel' ? '#' : ''}${channelContext.channelName}`
    : null;

  return (
    <>
      <StyledHeader>
        <StyledBrandmark>
          <StyledSparkleWrap>
            <IconSparkles size={13} />
          </StyledSparkleWrap>
          <StyledBrandName>KonnecctAI</StyledBrandName>
        </StyledBrandmark>
        {contextLabel ? (
          <StyledContextBadge title={contextLabel}>
            {contextLabel}
          </StyledContextBadge>
        ) : null}
        <IconButton
          Icon={IconX}
          size="small"
          variant="tertiary"
          ariaLabel={t`Close KonnecctAI`}
          onClick={close}
        />
      </StyledHeader>
      <StyledBody>
        <AIChatTab />
      </StyledBody>
    </>
  );
};

// ─── Public Component ─────────────────────────────────────────────────────────

/**
 * KonnecctAIPanel — slides into the right of the Sendbird Communications Hub.
 *
 * Design:
 * - Theme-aware (follows CRM light/dark mode via `themeCssVariables`)
 * - GPU-composited slide animation (transform, no layout reflow)
 * - Header: gradient sparkle ✦ icon + "KonnecctAI" wordmark + optional channel context badge
 * - Body: existing `AIChatTab` (streaming, threads, model picker — all pre-built)
 *
 * Context awareness:
 * - Channel name is displayed in the header badge
 * - The pending query (from @KonnecctAI mention) is auto-injected and sent
 */
export const KonnecctAIPanel = () => {
  const { isOpen } = useKonnecctAIPanel();

  return (
    <StyledPanelShell $open={isOpen} aria-label={t`KonnecctAI Panel`} role="complementary">
      {/*
       * AgentChatProvider must wrap AIChatTab — it mounts the streaming session.
       * Always rendered (not conditional) so the AI thread state persists
       * even when the panel is visually hidden.
       */}
      <AgentChatProvider>
        <KonnecctAIPanelInner />
      </AgentChatProvider>
    </StyledPanelShell>
  );
};
