import { useEffect, useRef } from 'react';
import { styled } from '@linaria/react';
import {
  IconMaximize,
  IconMicrophone,
  IconMicrophoneOff,
  IconMinimize,
  IconPhone,
  IconPhoneOff,
  IconVideo,
  IconVideoOff,
} from 'twenty-ui/display';
import { IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useCallOverlayOptional } from '@/chat/contexts/CallOverlayContext';

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  background: ${themeCssVariables.background.tertiary};
  flex: 1 1 auto;
  height: 200px;
  position: relative;
`;

const StyledVideoPlaceholder = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.light};
  display: flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  height: 100%;
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
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
`;

const StyledActiveDot = styled.span`
  animation: pulse 1.2s infinite;
  background: ${themeCssVariables.color.green};
  border-radius: 50%;
  flex-shrink: 0;
  height: 8px;
  width: 8px;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * GlobalCallOverlay — mounts at the root layout level so it persists
 * across all routes. When a call is active it floats bottom-right.
 * Minimized: compact dock bar. Expanded: video area + controls.
 */
export const GlobalCallOverlay = () => {
  const ctx = useCallOverlayOptional();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!ctx?.callState?.active) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Start timer only once when call becomes active
    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        ctx.setDuration((ctx.callState?.durationSeconds ?? 0) + 1);
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

  const { callState, endCall, toggleExpand, toggleMute, toggleVideo } = ctx;
  const { title, expanded, durationSeconds, muted, videoOn } = callState;

  if (expanded) {
    return (
      <StyledDock $expanded role="complementary" aria-label="Active call">
        <StyledExpandedHeader>
          <StyledActiveDot aria-hidden />
          <StyledTitle>{title}</StyledTitle>
          <StyledTimer>{formatDuration(durationSeconds)}</StyledTimer>
          <IconButton
            Icon={IconMinimize}
            variant="tertiary"
            size="small"
            ariaLabel="Minimize call"
            onClick={toggleExpand}
          />
        </StyledExpandedHeader>

        <StyledExpandedVideo>
          <StyledVideoPlaceholder>
            {videoOn ? 'Camera on' : 'Camera off'}
          </StyledVideoPlaceholder>
        </StyledExpandedVideo>

        <StyledExpandedControls>
          <IconButton
            Icon={muted ? IconMicrophoneOff : IconMicrophone}
            variant={muted ? 'primary' : 'tertiary'}
            size="small"
            ariaLabel={muted ? 'Unmute' : 'Mute'}
            onClick={toggleMute}
          />
          <IconButton
            Icon={videoOn ? IconVideo : IconVideoOff}
            variant={videoOn ? 'primary' : 'tertiary'}
            size="small"
            ariaLabel={videoOn ? 'Turn off camera' : 'Turn on camera'}
            onClick={toggleVideo}
          />
          <IconButton
            Icon={IconPhoneOff}
            variant="primary"
            accent="danger"
            size="small"
            ariaLabel="End call"
            onClick={endCall}
          />
        </StyledExpandedControls>
      </StyledDock>
    );
  }

  // Minimized dock
  return (
    <StyledDock $expanded={false} role="complementary" aria-label="Active call">
      <StyledActiveDot aria-hidden />
      <StyledTitle>{title}</StyledTitle>
      <StyledTimer>{formatDuration(durationSeconds)}</StyledTimer>
      <IconButton
        Icon={muted ? IconMicrophoneOff : IconMicrophone}
        variant="tertiary"
        size="small"
        ariaLabel={muted ? 'Unmute' : 'Mute'}
        onClick={toggleMute}
      />
      <IconButton
        Icon={IconMaximize}
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
        onClick={endCall}
      />
    </StyledDock>
  );
};
