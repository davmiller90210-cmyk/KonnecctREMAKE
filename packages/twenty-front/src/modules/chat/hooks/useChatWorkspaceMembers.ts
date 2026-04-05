import { useCallback, useEffect, useState } from 'react';

import { type ChatWorkspaceMemberOption } from '@/chat/types/chat-workspace-layout.type';

export const useChatWorkspaceMembers = (token: string | undefined) => {
  const [members, setMembers] = useState<ChatWorkspaceMemberOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!token) {
      setMembers([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/chat/workspace-members', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        setMembers([]);
        return;
      }

      const data = (await response.json()) as ChatWorkspaceMemberOption[];
      setMembers(Array.isArray(data) ? data : []);
    } catch {
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { members, isLoading, reload };
};
