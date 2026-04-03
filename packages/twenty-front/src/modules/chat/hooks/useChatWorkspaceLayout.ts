import { useCallback, useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { type ChatWorkspaceLayoutResponse } from '@/chat/types/chat-workspace-layout.type';

export const useChatWorkspaceLayout = () => {
  const tokenPair = useAtomValue(tokenPairState.atom);
  const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  const [layout, setLayout] = useState<ChatWorkspaceLayoutResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) {
      setLayout(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/chat/layout', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as ChatWorkspaceLayoutResponse;
      setLayout(data);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : 'Unknown error',
      );
      setLayout(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    layout,
    isLoading,
    error,
    reload,
  };
};
