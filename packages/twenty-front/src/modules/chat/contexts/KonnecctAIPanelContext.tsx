import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type KonnecctAIChannelContext = {
  /** The Sendbird channel URL currently selected */
  channelUrl: string | null;
  /** Display name of the channel or DM (e.g. "#general" or "John Smith") */
  channelName: string;
  /** Kind of selection — 'channel' | 'dm' | null */
  kind: 'channel' | 'dm' | null;
  /** Member display names in the current channel */
  memberNames: string[];
  /** Recent message snippets for context (last N messages) */
  recentMessages: Array<{ author: string; body: string; ts: number }>;
};

type KonnecctAIPanelContextValue = {
  /** Whether the KonnecctAI panel is open */
  isOpen: boolean;
  /** Open the panel, optionally with a pre-seeded query */
  open: (query?: string) => void;
  /** Close the panel */
  close: () => void;
  /** Toggle the panel */
  toggle: () => void;
  /**
   * Pre-seeded query text to inject into the AI composer when the panel opens.
   * Consumed once — cleared after read.
   */
  pendingQuery: string;
  /** Clear the pending query (called after injection) */
  clearPendingQuery: () => void;
  /** Live channel context forwarded to the AI as browsingContext  */
  channelContext: KonnecctAIChannelContext | null;
  setChannelContext: (ctx: KonnecctAIChannelContext | null) => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

export const KonnecctAIPanelContext =
  createContext<KonnecctAIPanelContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const KonnecctAIPanelProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState('');
  const [channelContext, setChannelContext] =
    useState<KonnecctAIChannelContext | null>(null);

  const open = useCallback((query = '') => {
    if (query) {
      setPendingQuery(query);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const clearPendingQuery = useCallback(() => {
    setPendingQuery('');
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      pendingQuery,
      clearPendingQuery,
      channelContext,
      setChannelContext,
    }),
    [
      isOpen,
      open,
      close,
      toggle,
      pendingQuery,
      clearPendingQuery,
      channelContext,
    ],
  );

  return (
    <KonnecctAIPanelContext.Provider value={value}>
      {children}
    </KonnecctAIPanelContext.Provider>
  );
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useKonnecctAIPanel = () => {
  const ctx = useContext(KonnecctAIPanelContext);
  if (!ctx) {
    throw new Error(
      'useKonnecctAIPanel must be used within KonnecctAIPanelProvider',
    );
  }
  return ctx;
};
