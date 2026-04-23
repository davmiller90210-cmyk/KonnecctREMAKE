const STORAGE_KEY = 'twenty.chat.sendSoundEnabled';

export const isChatSendSoundEnabled = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(STORAGE_KEY) === '1';
};

export const setChatSendSoundEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
};

/** Short, low-volume click — skipped when sound is disabled in localStorage. */
export const playChatSendSound = (): void => {
  if (typeof window === 'undefined' || !isChatSendSoundEnabled()) {
    return;
  }
  try {
    const AudioContextConstructor =
      window.AudioContext ||
      (
        window as unknown as {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!AudioContextConstructor) {
      return;
    }
    const ctx = new AudioContextConstructor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.015);
    oscillator.frequency.setValueAtTime(660, ctx.currentTime);
    oscillator.type = 'sine';
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.055);
    void ctx.close();
  } catch {
    // ignore
  }
};
