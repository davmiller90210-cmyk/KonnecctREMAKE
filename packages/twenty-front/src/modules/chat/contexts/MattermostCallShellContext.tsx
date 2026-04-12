import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type MattermostCallShellState = {
  open: boolean;
  baseUrl: string;
  teamName: string;
  channelName: string;
};

type MattermostCallShellContextValue = {
  callShell: MattermostCallShellState | null;
  openCallShell: (input: {
    baseUrl: string;
    teamName: string;
    channelName: string;
  }) => void;
  closeCallShell: () => void;
};

const MattermostCallShellContext =
  createContext<MattermostCallShellContextValue | null>(null);

export const MattermostCallShellProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [callShell, setCallShell] = useState<MattermostCallShellState | null>(
    null,
  );

  const openCallShell = useCallback(
    (input: { baseUrl: string; teamName: string; channelName: string }) => {
      setCallShell({
        open: true,
        baseUrl: input.baseUrl.replace(/\/$/, ''),
        teamName: input.teamName,
        channelName: input.channelName,
      });
    },
    [],
  );

  const closeCallShell = useCallback(() => {
    setCallShell(null);
  }, []);

  const value = useMemo(
    () => ({
      callShell,
      openCallShell,
      closeCallShell,
    }),
    [callShell, openCallShell, closeCallShell],
  );

  return (
    <MattermostCallShellContext.Provider value={value}>
      {children}
    </MattermostCallShellContext.Provider>
  );
};

export const useMattermostCallShellOptional = () =>
  useContext(MattermostCallShellContext);

export const useMattermostCallShell = () => {
  const ctx = useContext(MattermostCallShellContext);

  if (!ctx) {
    throw new Error(
      'useMattermostCallShell must be used within MattermostCallShellProvider',
    );
  }

  return ctx;
};
