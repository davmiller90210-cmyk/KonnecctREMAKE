import { Command } from '@/command-menu-item/display/components/Command';
import { useSelectedRecordIdOrThrow } from '@/command-menu-item/record/single-record/hooks/useSelectedRecordIdOrThrow';
import { useContextStoreObjectMetadataItemOrThrow } from '@/context-store/hooks/useContextStoreObjectMetadataItemOrThrow';
import { useSwitchToNewAIChat } from '@/ai/hooks/useSwitchToNewAIChat';
import {
  AGENT_CHAT_NEW_THREAD_DRAFT_KEY,
  agentChatDraftsByThreadIdState,
} from '@/ai/states/agentChatDraftsByThreadIdState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

export const AskKonnecctAgentSingleRecordCommand = () => {
  const recordId = useSelectedRecordIdOrThrow();
  const { objectMetadataItem } = useContextStoreObjectMetadataItemOrThrow();
  const setAgentChatDraftsByThreadId = useSetAtomState(
    agentChatDraftsByThreadIdState,
  );
  const { switchToNewChat } = useSwitchToNewAIChat();

  const handleClick = () => {
    setAgentChatDraftsByThreadId((previousDrafts) => ({
      ...previousDrafts,
      [AGENT_CHAT_NEW_THREAD_DRAFT_KEY]: [
        `Analyze this ${objectMetadataItem.labelSingular} and propose next best actions.`,
        `Record ID: ${recordId}`,
        '',
        'Please include:',
        '1) current status summary',
        '2) risks and blockers',
        '3) recommended follow-ups',
        '4) draft messages/tasks I can execute',
      ].join('\n'),
    }));

    switchToNewChat();
  };

  return <Command onClick={handleClick} />;
};
