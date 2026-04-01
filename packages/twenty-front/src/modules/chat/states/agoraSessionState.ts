import { atom } from 'jotai';

// ─── Connection States ────────────────────────────────────────────────────────

export type ChatConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export const agoraConnectionStateAtom = atom<ChatConnectionState>('idle');
export const agoraConnectionErrorAtom = atom<string | null>(null);

// ─── Data Models ──────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  type: 'txt' | 'img' | 'audio' | 'video' | 'file' | 'custom';
  text?: string;
  url?: string;
  filename?: string;
  createdAt: number;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  direction: 'in' | 'out';
}

export interface ChatConversation {
  id: string;
  type: 'singleChat' | 'groupChat' | 'chatRoom';
  name: string;
  unreadCount: number;
  lastMessage?: ChatMessage;
}

// ─── State Atoms ──────────────────────────────────────────────────────────────

export const agoraConversationsAtom = atom<ChatConversation[]>([]);
export const selectedConversationIdAtom = atom<string | null>(null);

export const currentMessagesAtom = atom<Record<string, ChatMessage[]>>({});
