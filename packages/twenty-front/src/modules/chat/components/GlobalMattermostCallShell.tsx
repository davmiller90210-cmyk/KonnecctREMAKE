import { useMattermostCallShell } from '@/chat/contexts/MattermostCallShellContext';
import { styled } from '@linaria/react';
import { IconExternalLink, IconX } from 'twenty-ui/display';
import { IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledWrap = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  bottom: ${themeCssVariables.spacing[4]};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  max-height: min(520px, 70vh);
  overflow: hidden;
  position: fixed;
  right: ${themeCssVariables.spacing[4]};
  width: min(400px, calc(100vw - ${themeCssVariables.spacing[8]}));
  z-index: 20000;
`;

const StyledBar = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  min-height: 40px;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: 600;
`;

const StyledHint = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  padding: 0 ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[2]};
`;

const StyledIframe = styled.iframe`
  border: none;
  flex: 1 1 auto;
  min-height: 320px;
  width: 100%;
`;

/**
 * MVP: embeds the Mattermost web client for the current team/channel so Calls
 * (plugin UI) stays usable while the rest of chat is Twenty-native. Full RTC
 * without this iframe is a follow-up (Mattermost Calls plugin APIs).
 */
export const GlobalMattermostCallShell = () => {
  const { callShell, closeCallShell } = useMattermostCallShell();

  if (!callShell?.open) {
    return null;
  }

  const src = `${callShell.baseUrl}/${encodeURIComponent(callShell.teamName)}/channels/${encodeURIComponent(callShell.channelName)}`;

  return (
    <StyledWrap role="complementary" aria-label="Mattermost calls">
      <StyledBar>
        <StyledTitle>Calls (Mattermost)</StyledTitle>
        <div>
          <IconButton
            Icon={IconExternalLink}
            variant="tertiary"
            size="small"
            ariaLabel="Open in new tab"
            title="Open in new tab"
            onClick={() => window.open(src, '_blank', 'noopener,noreferrer')}
          />
          <IconButton
            Icon={IconX}
            variant="tertiary"
            size="small"
            ariaLabel="Close calls panel"
            title="Close"
            onClick={closeCallShell}
          />
        </div>
      </StyledBar>
      <StyledHint>
        Start or join a call from the Mattermost toolbar inside this panel.
        Native WebRTC without iframe requires deeper Calls-plugin integration.
      </StyledHint>
      <StyledIframe
        allow="microphone; camera; display-capture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        src={src}
        title="Mattermost calls"
      />
    </StyledWrap>
  );
};
