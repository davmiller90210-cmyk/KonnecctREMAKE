import { useEffect, useCallback, useRef } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import AC from 'agora-chat';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';

import {
  agoraConnectionStateAtom,
  agoraConnectionErrorAtom,
  agoraConversationsAtom,
  currentMessagesAtom,
  ChatMessage,
} from '../states/agoraSessionState';
import { tokenPairState } from '@/auth/states/tokenPairState';
const AGORA_APP_KEY = '7110032205#200010602';

let _agoraClient: AC.Connection | null = null;

export const useAgoraChat = () => {
  const setConnectionState = useSetAtom(agoraConnectionStateAtom);
  const setConnectionError = useSetAtom(agoraConnectionErrorAtom);
  const setConversations = useSetAtom(agoraConversationsAtom);
  const setMessages = useSetAtom(currentMessagesAtom);
  const tokenPair = useAtomValue(tokenPairState.atom);
  const crmToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const { getToken: getClerkToken } = useClerkAuth();
  const initRef = useRef(false);

  // 1. Initialize Client
  useEffect(() => {
    if (!initRef.current) {
      if (!_agoraClient) {
        _agoraClient = new AC.connection({
          appKey: AGORA_APP_KEY,
        });
      }
      initRef.current = true;
    }

    if (_agoraClient) {
      _agoraClient.addEventHandler('connection', {
        onOpened: () => {
          console.log('[KONNECCT-AGORA] Connection opened');
          setConnectionState('connected');
        },
        onConnected: () => {
          console.log('[KONNECCT-AGORA] Connection established');
          setConnectionState('connected');
        },
        onClosed: () => {
          console.log('[KONNECCT-AGORA] Connection closed');
          setConnectionState('disconnected');
        },
        onDisconnected: () => {
          console.log('[KONNECCT-AGORA] Connection interrupted');
          setConnectionState('disconnected');
        },
        onError: (err) => {
          console.error('[KONNECCT-AGORA] Connection error:', err);
          setConnectionError(err.message || 'Unknown Agora error');
          setConnectionState('error');
        },
      });

      _agoraClient.addEventHandler('message_events', {
        onTextMessage: (msg) => handleIncomingMessage(msg, 'txt'),
        onImageMessage: (msg) => handleIncomingMessage(msg, 'img'),
        onAudioMessage: (msg) => handleIncomingMessage(msg, 'audio'),
        onVideoMessage: (msg) => handleIncomingMessage(msg, 'video'),
        onFileMessage: (msg) => handleIncomingMessage(msg, 'file'),
        onCustomMessage: (msg) => handleIncomingMessage(msg, 'custom'),
      });
    }

    return () => {
      if (_agoraClient) {
        _agoraClient.removeEventHandler('connection_events');
        _agoraClient.removeEventHandler('message_events');
      }
    };
  }, [setConnectionState, setConnectionError]);

  // Handle incoming formatted
  const handleIncomingMessage = useCallback((msg: any, type: string) => {
    const actualConvoId = _agoraClient?.user === msg.from ? msg.to : msg.from;

    const newChatMessage: ChatMessage = {
      id: msg.id,
      conversationId: actualConvoId,
      senderId: msg.from,
      senderName: msg.ext?.senderName || msg.from,
      type: type as any,
      text: msg.msg,
      url: msg.url,
      filename: msg.filename,
      createdAt: msg.time || Date.now(),
      status: 'delivered',
      direction: _agoraClient?.user === msg.from ? 'out' : 'in',
    };

    setMessages((prev) => ({
      ...prev,
      [actualConvoId]: [...(prev[actualConvoId] || []), newChatMessage],
    }));

    // Update conversation list preview
    setConversations((prev) => {
      const existing = prev.find((c) => c.id === actualConvoId);
      if (existing) {
        return prev.map((c) =>
          c.id === actualConvoId
            ? { ...c, lastMessage: newChatMessage, unreadCount: c.unreadCount + 1 }
            : c
        );
      }
      return [
        ...prev,
        {
          id: actualConvoId,
          type: msg.chatType === 'groupChat' ? 'groupChat' : 'singleChat',
          name: msg.ext?.senderName || actualConvoId,
          unreadCount: 1,
          lastMessage: newChatMessage,
        },
      ];
    });
  }, [setMessages, setConversations]);


  // 2. Connect
  const connectToAgora = useCallback(async () => {
    const resolveAuthToken = async () => {
      if (crmToken) {
        return crmToken;
      }

      return await getClerkToken();

    };

    try {
      const authToken = await resolveAuthToken();

      if (!authToken) {
        setConnectionError('Missing CRM/Clerk auth token');
        setConnectionState('error');
        return;
      }

      setConnectionState('connecting');
      const response = await fetch('/agora/token', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Agora token');
      }

      const { agoraToken, userIdentifier } = await response.json();

      _agoraClient?.open({
        user: userIdentifier,
        agoraToken: agoraToken,
      });

    } catch (error: any) {
      setConnectionError(error.message);
      setConnectionState('error');
    }
  }, [crmToken, getClerkToken, setConnectionState, setConnectionError]);

  const disconnectFromAgora = useCallback(() => {
    _agoraClient?.close();
  }, []);

  const sendMessage = useCallback((targetId: string, text: string, chatType: 'singleChat' | 'groupChat' = 'singleChat') => {
    if (!_agoraClient) return;

    const msg = AC.message.create({
      to: targetId,
      type: 'txt',
      msg: text,
      chatType,
    });

    handleIncomingMessage({...msg, time: Date.now(), from: _agoraClient.user}, 'txt');
    _agoraClient.send(msg).catch((err) => console.error(err));
  }, [handleIncomingMessage]);

  const sendAttachment = useCallback((targetId: string, file: File, type: 'img' | 'file' | 'audio' | 'video', chatType: 'singleChat' | 'groupChat' = 'singleChat', extraParams?: any) => {
    if (!_agoraClient) return;

    const msg = AC.message.create({
      type,
      to: targetId,
      chatType,
      file: {
        data: file,
        filename: file.name,
        url: '', // It will be generated by Agora servers
      },
      ...extraParams
    });

    const localUrl = URL.createObjectURL(file);
    handleIncomingMessage({...msg, url: localUrl, time: Date.now(), from: _agoraClient.user}, type);
    
    _agoraClient.send(msg).catch((err) => console.error(err));
  }, [handleIncomingMessage]);

  return {
    connectToAgora,
    disconnectFromAgora,
    sendMessage,
    sendAttachment,
    client: _agoraClient,
  };
};
