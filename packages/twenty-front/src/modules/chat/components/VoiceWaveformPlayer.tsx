import { useEffect, useRef, useState } from 'react';
import { styled } from '@linaria/react';
import { IconPlayerPlay, IconPlayerPause } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { CHAT_ACCENT_GRADIENT } from '@/chat/constants/chatAccentTheme';

const StyledWrap = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  min-width: 0;
`;

const StyledPlay = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  flex-shrink: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${CHAT_ACCENT_GRADIENT};
  color: #fff;
`;

const StyledBars = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 28px;
  flex: 1 1 auto;
  min-width: 0;
`;

const StyledBar = styled.span<{ $h: number; $active: boolean }>`
  width: 3px;
  border-radius: 2px;
  height: ${({ $h }) => `${$h}px`};
  background: ${({ $active }) =>
    $active ? CHAT_ACCENT_GRADIENT : themeCssVariables.background.transparent.medium};
  opacity: ${({ $active }) => ($active ? 1 : 0.45)};
  transition: height 0.12s ease-out, opacity 0.12s ease-out;
`;

const StyledHiddenAudio = styled.audio`
  display: none;
`;

const BAR_HEIGHTS = [8, 14, 10, 22, 16, 20, 12, 18, 9, 15, 11, 19];

type VoiceWaveformPlayerProps = {
  src: string | undefined;
};

export const VoiceWaveformPlayer = ({ src }: VoiceWaveformPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!playing) {
      return;
    }

    const id = window.setInterval(() => setTick((n) => n + 1), 160);

    return () => window.clearInterval(id);
  }, [playing]);

  const toggle = () => {
    const el = audioRef.current;

    if (!el || !src) {
      return;
    }

    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  };

  useEffect(() => {
    const el = audioRef.current;

    if (!el) {
      return;
    }

    const onEnded = () => setPlaying(false);

    el.addEventListener('ended', onEnded);

    return () => el.removeEventListener('ended', onEnded);
  }, [src]);

  return (
    <StyledWrap>
      <StyledHiddenAudio ref={audioRef} src={src} preload="metadata" />
      <StyledPlay type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <IconPlayerPause /> : <IconPlayerPlay />}
      </StyledPlay>
      <StyledBars>
        {BAR_HEIGHTS.map((h, i) => (
          <StyledBar
            key={i}
            $h={playing ? h + ((tick + i) % 3) * 2 : h}
            $active={playing}
          />
        ))}
      </StyledBars>
    </StyledWrap>
  );
};
