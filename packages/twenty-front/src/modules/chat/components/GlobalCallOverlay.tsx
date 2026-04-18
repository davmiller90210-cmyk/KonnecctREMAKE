import { useEffect, useRef } from 'react';
import { styled } from '@linaria/react';
import {
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhoneOff,
  IconVideo,
  IconVideoOff,
} from 'twenty-ui/display';
import { IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useCallOverlayOptional } from '@/chat/contexts/CallOverlayContext';
import { useSendbirdCallsOptional } from '@/chat/providers/SendbirdCallsProvider';

const StyledDock = styled.div<{ $expanded: boolean }>`
  align-items: ${({ $expanded }) => ($expanded ? 'stretch' : 'center')};
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${({ $expanded }) =>
    $expanded
      ? themeCssVariables.border.radius.md
      : themeCssVariables.border.radius.xl};
  bottom: ${themeCssVariables.spacing[4]};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: ${({ $expanded }) => ($expanded ? 'column' : 'row')};
  gap: ${({ $expanded }) => ($expanded ? '0' : themeCssVariables.spacing[2])};
  min-width: ${({ $expanded }) => ($expanded ? '340px' : 'auto')};
  overflow: hidden;
  padding: ${({ $expanded }) => ($expanded ? '0' : themeCssVariables.spacing[2])};
  padding-left: ${({ $expanded }) =>
    $expanded ? '0' : themeCssVariables.spacing[3]};
  position: fixed;
  right: ${themeCssVariables.spacing[4]};
  width: ${({ $expanded }) => ($expanded ? '340px' : 'auto')};
  z-index: 20000;
`;

const StyledExpandedHeader = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  min-height: 48px;
  padding: 0 ${themeCssVariables.spacing[3]};
`;

const StyledExpandedVideo = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.tertiary};
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex: 1 1 auto;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  height: 200px;
  justify-content: center;
`;

const StyledExpandedControls = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border-top: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: center;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledTimer = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  flex-shrink: 0;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  font-variant-numeric: tabular-nums;
`;

const StyledActiveDot = styled.span`
  animation: pulse 1.2s infinite;
  background: ${themeCssVariables.color.green};
  border-radius: 50%;
  flex-shrink: 0;
  height: 8px;
  width: 8px;

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
`;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Call controls dock. Sendbird attaches media to hidden `<video>` elements in
 * `SendbirdCallsProvider`; this UI stays lightweight and shell-global.
 */
export const GlobalCallOverlay = () => {
  const ctx = useCallOverlayOptional();
  const calls = useSendbirdCallsOptional();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationTickRef = useRef(0);

  useEffect(() => {
    if (!ctx?.callState?.active) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      durationTickRef.current = 0;
      return;
    }

    durationTickRef.current = ctx.callState.durationSeconds;

    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        durationTickRef.current += 1;
        ctx.setDuration(durationTickRef.current);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [ctx, ctx?.callState?.active]);

  if (!ctx || !ctx.callState?.active) {
    return null;
  }

  const direct = calls?.activeCall ?? null;
  const sdkMuted = direct
    ? !direct.isLocalAudioEnabled
    : (ctx.callState.muted ?? false);
  const sdkVideoOn = direct
    ? direct.isVideoCall && direct.isLocalVideoEnabled
    : (ctx.callState.videoOn ?? false);

  const handleEnd = () => {
    if (calls?.activeCall) {
      calls.endActiveCall();
    } else {
      ctx.endCall();
    }
  };

  const handleMute = () => {
    calls?.toggleMute();
  };

  const handleVideo = () => {
    calls?.toggleVideo();
  };

  const { callState, toggleExpand } = ctx;
  const { title, expanded, durationSeconds } = callState;

  return (
    <StyledDock $expanded={expanded} role="complementary" aria-label="Active call">
      {expanded && (
        <StyledExpandedHeader>
          <StyledActiveDot aria-hidden />
          <StyledTitle>{title}</StyledTitle>
          <StyledTimer>{formatDuration(durationSeconds)}</StyledTimer>
          <IconButton
            Icon={IconArrowsDiagonalMinimize2}
            variant="tertiary"
            size="small"
            ariaLabel="Minimize call"
            onClick={toggleExpand}
          />
        </StyledExpandedHeader>
      )}

      {expanded && (
        <StyledExpandedVideo>
          {sdkVideoOn ? 'Video call' : 'Voice call'}
        </StyledExpandedVideo>
      )}

      {expanded ? (
        <StyledExpandedControls>
          <IconButton
            Icon={sdkMuted ? IconMicrophoneOff : IconMicrophone}
            variant={sdkMuted ? 'primary' : 'tertiary'}
            size="small"
            ariaLabel={sdkMuted ? 'Unmute' : 'Mute'}
            onClick={handleMute}
          />
          <IconButton
            Icon={sdkVideoOn ? IconVideo : IconVideoOff}
            variant={sdkVideoOn ? 'primary' : 'tertiary'}
            size="small"
            ariaLabel={sdkVideoOn ? 'Turn off camera' : 'Turn on camera'}
            onClick={handleVideo}
          />
          <IconButton
            Icon={IconPhoneOff}
            variant="primary"
            accent="danger"
            size="small"
            ariaLabel="End call"
            onClick={handleEnd}
          />
        </StyledExpandedControls>
      ) : (
        <>
          <StyledActiveDot aria-hidden />
          <StyledTitle>{title}</StyledTitle>
          <StyledTimer>{formatDuration(durationSeconds)}</StyledTimer>
          <IconButton
            Icon={sdkMuted ? IconMicrophoneOff : IconMicrophone}
            variant="tertiary"
            size="small"
            ariaLabel={sdkMuted ? 'Unmute' : 'Mute'}
            onClick={handleMute}
          />
          <IconButton
            Icon={IconArrowsDiagonal}
            variant="tertiary"
            size="small"
            ariaLabel="Expand call"
            onClick={toggleExpand}
          />
          <IconButton
            Icon={IconPhoneOff}
            variant="tertiary"
            size="small"
            ariaLabel="End call"
            onClick={handleEnd}
          />
        </>
      )}
    </StyledDock>
  );
};
