import { useEffect, useLayoutEffect, useRef } from 'react';
import { styled } from '@linaria/react';
import {
  IconArrowsDiagonal,
  IconChevronDown,
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
  width: ${({ $expanded }) => ($expanded ? 'min(420px, 92vw)' : 'auto')};
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

const StyledVideoStage = styled.div`
  background: #0b0b0c;
  flex: 1 1 auto;
  min-height: 220px;
  position: relative;
`;

const StyledRemoteVideo = styled.video`
  height: 100%;
  object-fit: contain;
  width: 100%;
`;

const StyledLocalVideo = styled.video<{ $pip: boolean }>`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  bottom: ${themeCssVariables.spacing[2]};
  object-fit: cover;
  position: absolute;
  right: ${themeCssVariables.spacing[2]};
  ${({ $pip }) =>
    $pip
      ? `
 height: 88px;
    width: 118px;
  `
      : `
    height: 1px;
    width: 1px;
    opacity: 0;
    pointer-events: none;
  `}
`;

const StyledVoiceFallback = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  height: 100%;
  justify-content: center;
  left: 0;
  pointer-events: none;
  position: absolute;
  top: 0;
  width: 100%;
  z-index: 1;
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

export const GlobalCallOverlay = () => {
  const ctx = useCallOverlayOptional();
  const calls = useSendbirdCallsOptional();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationTickRef = useRef(0);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useLayoutEffect(() => {
    if (!ctx?.callState?.active || !calls?.activeCall) {
      return;
    }
    const local = localVideoRef.current;
    const remote = remoteVideoRef.current;
    if (!local || !remote) {
      return;
    }
    if (ctx.callState.expanded) {
      void calls.bindToVisibleOverlayVideos(local, remote);
    } else {
      void calls.bindToHiddenBootstrapVideos();
    }
  }, [
    calls,
    ctx?.callState?.active,
    ctx?.callState?.expanded,
    calls?.activeCall?.callId,
  ]);

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
  const isVideoCall = direct
    ? direct.isVideoCall
    : (ctx.callState.videoOn ?? false);
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
            Icon={IconChevronDown}
            variant="tertiary"
            size="small"
            ariaLabel="Minimize call"
            onClick={toggleExpand}
          />
        </StyledExpandedHeader>
      )}

      {expanded && (
        <StyledVideoStage>
          <StyledRemoteVideo
            ref={remoteVideoRef}
            playsInline
            autoPlay
            aria-label="Remote video"
          />
          <StyledLocalVideo
            ref={localVideoRef}
            $pip={isVideoCall}
            playsInline
            muted
            autoPlay
            aria-label="Local video"
          />
          {!isVideoCall ? (
            <StyledVoiceFallback>{`Voice call`}</StyledVoiceFallback>
          ) : null}
        </StyledVideoStage>
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
          {isVideoCall ? (
            <IconButton
              Icon={sdkVideoOn ? IconVideo : IconVideoOff}
              variant={sdkVideoOn ? 'primary' : 'tertiary'}
              size="small"
              ariaLabel={sdkVideoOn ? 'Turn off camera' : 'Turn on camera'}
              onClick={handleVideo}
            />
          ) : null}
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
