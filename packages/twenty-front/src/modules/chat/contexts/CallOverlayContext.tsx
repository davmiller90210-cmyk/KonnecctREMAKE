import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CallOverlayState = {
  /** Call is currently active (minimized dock or expanded) */
  active: boolean;
  /** Display name of the person/channel being called */
  title: string;
  /** Whether the call is expanded (true) or minimized to dock (false) */
  expanded: boolean;
  /** Call duration in seconds (updated by the consumer) */
  durationSeconds: number;
  /** Whether local audio is muted */
  muted: boolean;
  /** Whether local video is on */
  videoOn: boolean;
};

type CallOverlayContextValue = {
  callState: CallOverlayState | null;
  /** Start a call - pass the title (name of contact/channel) */
  startCall: (title: string) => void;
  /** End the current call */
  endCall: () => void;
  /** Toggle minimized/expanded state */
  toggleExpand: () => void;
  /** Toggle mute */
  toggleMute: () => void;
  /** Toggle video */
  toggleVideo: () => void;
  /** Update duration (called every second by caller) */
  setDuration: (seconds: number) => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const CallOverlayContext = createContext<CallOverlayContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const CallOverlayProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [callState, setCallState] = useState<CallOverlayState | null>(null);

  const startCall = useCallback((title: string) => {
    setCallState({
      active: true,
      title,
      expanded: false,
      durationSeconds: 0,
      muted: false,
      videoOn: false,
    });
  }, []);

  const endCall = useCallback(() => {
    setCallState(null);
  }, []);

  const toggleExpand = useCallback(() => {
    setCallState((prev) =>
      prev ? { ...prev, expanded: !prev.expanded } : prev,
    );
  }, []);

  const toggleMute = useCallback(() => {
    setCallState((prev) =>
      prev ? { ...prev, muted: !prev.muted } : prev,
    );
  }, []);

  const toggleVideo = useCallback(() => {
    setCallState((prev) =>
      prev ? { ...prev, videoOn: !prev.videoOn } : prev,
    );
  }, []);

  const setDuration = useCallback((seconds: number) => {
    setCallState((prev) =>
      prev ? { ...prev, durationSeconds: seconds } : prev,
    );
  }, []);

  const value = useMemo(
    () => ({
      callState,
      startCall,
      endCall,
      toggleExpand,
      toggleMute,
      toggleVideo,
      setDuration,
    }),
    [callState, startCall, endCall, toggleExpand, toggleMute, toggleVideo, setDuration],
  );

  return (
    <CallOverlayContext.Provider value={value}>
      {children}
    </CallOverlayContext.Provider>
  );
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useCallOverlay = () => {
  const ctx = useContext(CallOverlayContext);
  if (!ctx) {
    throw new Error(
      'useCallOverlay must be used within CallOverlayProvider',
    );
  }
  return ctx;
};

export const useCallOverlayOptional = () => useContext(CallOverlayContext);
