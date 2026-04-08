import { styled } from '@linaria/react';
import { useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { DropZone } from '@/activities/files/components/DropZone';
import { AIChatEditorSection } from '@/ai/components/AIChatEditorSection';
import { AIChatStandaloneError } from '@/ai/components/AIChatStandaloneError';
import { AIChatSkeletonLoader } from '@/ai/components/internal/AIChatSkeletonLoader';
import { useAIChatFileUpload } from '@/ai/hooks/useAIChatFileUpload';
import { AGENT_CHAT_NEW_THREAD_DRAFT_KEY } from '@/ai/states/agentChatDraftsByThreadIdState';
import { currentAIChatThreadState } from '@/ai/states/currentAIChatThreadState';
import { threadIdCreatedFromDraftState } from '@/ai/states/threadIdCreatedFromDraftState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { AIChatTabMessageList } from '@/ai/components/AIChatTabMessageList';

const StyledContainer = styled.div<{ isDraggingFile: boolean }>`
  background: ${themeCssVariables.background.primary};
  display: flex;
  flex-direction: column;
  height: ${({ isDraggingFile }) =>
    isDraggingFile ? `calc(100% - 24px)` : '100%'};
  padding: ${({ isDraggingFile }) =>
    isDraggingFile ? themeCssVariables.spacing[3] : '0'};
`;

type AIChatTabProps = {
  /** When true, only the message list + status UI is shown (no bottom composer). */
  hideComposer?: boolean;
};

export const AIChatTab = ({ hideComposer = false }: AIChatTabProps) => {
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const currentAIChatThread = useAtomStateValue(currentAIChatThreadState);
  const threadIdCreatedFromDraft = useAtomStateValue(
    threadIdCreatedFromDraftState,
  );
  const draftKey = currentAIChatThread;
  const editorSectionKey =
    draftKey !== AGENT_CHAT_NEW_THREAD_DRAFT_KEY &&
    draftKey === threadIdCreatedFromDraft
      ? AGENT_CHAT_NEW_THREAD_DRAFT_KEY
      : draftKey;

  const { uploadFiles } = useAIChatFileUpload();

  return (
    <StyledContainer
      isDraggingFile={isDraggingFile}
      onDragEnter={() => setIsDraggingFile(true)}
    >
      {isDraggingFile && (
        <DropZone
          setIsDraggingFile={setIsDraggingFile}
          onUploadFiles={uploadFiles}
        />
      )}
      {!isDraggingFile && (
        <>
          {hideComposer ? (
            <>
              <AIChatStandaloneError />
              <AIChatSkeletonLoader />
              <AIChatTabMessageList />
            </>
          ) : (
            <>
              <AIChatTabMessageList />
              <AIChatEditorSection key={editorSectionKey} />
            </>
          )}
        </>
      )}
    </StyledContainer>
  );
};
