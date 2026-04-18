/* eslint-disable twenty/no-state-useref -- Sendbird Calls SDK requires stable media element refs */
import { styled } from '@linaria/react';
import * as SendBirdCall from 'sendbird-calls';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useCallOverlay } from '@/chat/contexts/CallOverlayContext';
import { useSendbirdClient } from '@/chat/providers/SendbirdClientProvider';

const StyledBootstrapVideo = styled.video`
  height: 1px;
  left: 0;
  opacity: 0;
  pointer-events: none;
  position: fixed;
  top: 0;
  width: 1px;
`;

const CALL_LISTENER_KEY = 'konnecct-sendbird-app-calls';

type SendbirdCallsContextValue = {
  dialDirect: (args: {
    peerUserId: string;
    isVideoCall: boolean;
    title: string;
  }) => void;
  incomingCall: SendBirdCall.DirectCall | null;
  activeCall: SendBirdCall.DirectCall | null;
  acceptIncoming: () => void;
  declineIncoming: () => void;
  endActiveCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  /** Re-attach media to the overlay `<video>` elements (expanded dock). */
  bindToVisibleOverlayVideos: (
    local: HTMLVideoElement,
    remote: HTMLVideoElement,
  ) => Promise<void>;
  /** Restore media to bootstrap elements (minimized dock). */
  bindToHiddenBootstrapVideos: () => Promise<void>;
};

const SendbirdCallsContext = createContext<SendbirdCallsContextValue | null>(
  null,
);

export const SendbirdCallsProvider = ({ children }: { children: ReactNode }) => {
  const { callsReady } = useSendbirdClient();
  const {
    startCall: startOverlayCall,
    endCall: endOverlayCall,
    toggleMute: toggleOverlayMute,
    toggleVideo: toggleOverlayVideo,
  } = useCallOverlay();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeCallRef = useRef<SendBirdCall.DirectCall | null>(null);

  const [incomingCall, setIncomingCall] =
    useState<SendBirdCall.DirectCall | null>(null);
  const [activeCall, setActiveCall] =
    useState<SendBirdCall.DirectCall | null>(null);
  const [, refreshCallUi] = useReducer((x: number) => x + 1, 0);

  activeCallRef.current = activeCall;

  useEffect(() => {
    if (!callsReady) {
      return;
    }

    try {
      SendBirdCall.useMedia({ audio: true, video: true });
    } catch {
      /* Permissions may still be granted when placing a call. */
    }
  }, [callsReady]);

  useEffect(() => {
    if (!callsReady) {
      return;
    }

    SendBirdCall.addListener(CALL_LISTENER_KEY, {
      onRinging: (call) => {
        setIncomingCall(call);
      },
    });

    return () => {
      try {
        SendBirdCall.removeListener(CALL_LISTENER_KEY);
      } catch {
        /* noop */
      }
    };
  }, [callsReady]);

  const bindToVisibleOverlayVideos = useCallback(
    async (local: HTMLVideoElement, remote: HTMLVideoElement) => {
      const call = activeCallRef.current;
      if (!call) {
        return;
      }
      try {
        await call.setLocalMediaView(local);
        await call.setRemoteMediaView(remote);
      } catch {
        /* noop */
      }
    },
    [],
  );

  const bindToHiddenBootstrapVideos = useCallback(async () => {
    const call = activeCallRef.current;
    const localEl = localVideoRef.current;
    const remoteEl = remoteVideoRef.current;
    if (!call || !localEl || !remoteEl) {
      return;
    }
    try {
      await call.setLocalMediaView(localEl);
      await call.setRemoteMediaView(remoteEl);
    } catch {
      /* noop */
    }
  }, []);

  const attachEndedHandler = useCallback(
    (call: SendBirdCall.DirectCall) => {
      const prev = call.onEnded;
      call.onEnded = (ended) => {
        setActiveCall(null);
        setIncomingCall(null);
        activeCallRef.current = null;
        endOverlayCall();
        refreshCallUi();
        prev?.(ended);
      };
    },
    [endOverlayCall],
  );

  const dialDirect = useCallback(
    ({
      peerUserId,
      isVideoCall,
      title,
    }: {
      peerUserId: string;
      isVideoCall: boolean;
      title: string;
    }) => {
      if (!callsReady) {
        return;
      }

      const localEl = localVideoRef.current;
      const remoteEl = remoteVideoRef.current;

      if (!localEl || !remoteEl) {
        return;
      }

      try {
        const call = SendBirdCall.dial({
          userId: peerUserId,
          isVideoCall,
          callOption: {
            audioEnabled: true,
            videoEnabled: isVideoCall,
            localMediaView: localEl,
            remoteMediaView: remoteEl,
          },
        });

        attachEndedHandler(call);
        setActiveCall(call);
        activeCallRef.current = call;
        startOverlayCall(title, { isVideoCall });
        refreshCallUi();
      } catch {
        /* noop — user can retry */
      }
    },
    [attachEndedHandler, callsReady, startOverlayCall],
  );

  const acceptIncoming = useCallback(() => {
    const call = incomingCall;
    if (!call) {
      return;
    }

    const localEl = localVideoRef.current;
    const remoteEl = remoteVideoRef.current;

    if (!localEl || !remoteEl) {
      return;
    }

    call.accept({
      callOption: {
        audioEnabled: true,
        videoEnabled: call.isVideoCall,
        localMediaView: localEl,
        remoteMediaView: remoteEl,
      },
    });

    attachEndedHandler(call);
    setActiveCall(call);
    activeCallRef.current = call;
    setIncomingCall(null);
    startOverlayCall(call.remoteUser?.nickname ?? 'Call', {
      isVideoCall: call.isVideoCall,
    });
    refreshCallUi();
  }, [attachEndedHandler, incomingCall, startOverlayCall]);

  const declineIncoming = useCallback(() => {
    incomingCall?.end();
    setIncomingCall(null);
  }, [incomingCall]);

  const endActiveCall = useCallback(() => {
    activeCall?.end();
    setActiveCall(null);
    setIncomingCall(null);
    activeCallRef.current = null;
    endOverlayCall();
  }, [activeCall, endOverlayCall]);

  const toggleMute = useCallback(() => {
    if (activeCall) {
      if (activeCall.isLocalAudioEnabled) {
        activeCall.muteMicrophone();
      } else {
        activeCall.unmuteMicrophone();
      }
      refreshCallUi();
      return;
    }

    toggleOverlayMute();
  }, [activeCall, toggleOverlayMute]);

  const toggleVideo = useCallback(() => {
    if (activeCall?.isVideoCall) {
      if (activeCall.isLocalVideoEnabled) {
        activeCall.stopVideo();
      } else {
        void activeCall.startVideo();
      }
      refreshCallUi();
      return;
    }

    toggleOverlayVideo();
  }, [activeCall, toggleOverlayVideo]);

  const value: SendbirdCallsContextValue = {
    dialDirect,
    incomingCall,
    activeCall,
    acceptIncoming,
    declineIncoming,
    endActiveCall,
    toggleMute,
    toggleVideo,
    bindToVisibleOverlayVideos,
    bindToHiddenBootstrapVideos,
  };

  return (
    <SendbirdCallsContext.Provider value={value}>
      <StyledBootstrapVideo
        ref={localVideoRef}
        playsInline
        muted
        autoPlay
        aria-hidden
      />
      <StyledBootstrapVideo ref={remoteVideoRef} playsInline autoPlay aria-hidden />
      {children}
    </SendbirdCallsContext.Provider>
  );
};

export const useSendbirdCalls = () => {
  const ctx = useContext(SendbirdCallsContext);
  if (!ctx) {
    throw new Error('useSendbirdCalls must be used within SendbirdCallsProvider');
  }
  return ctx;
};

export const useSendbirdCallsOptional = () =>
  useContext(SendbirdCallsContext);
