import { type ReactNode } from 'react';

type SSEProviderProps = {
  children: ReactNode;
};

export const SSEProvider = ({ children }: SSEProviderProps) => {
  return (
    <>
      {/* Temporary production hotfix:
          disable SSE subscription lifecycle to avoid
          EventStreamException(EVENT_STREAM_DOES_NOT_EXIST)
          cascading into runtime failures. */}
      {children}
    </>
  );
};
