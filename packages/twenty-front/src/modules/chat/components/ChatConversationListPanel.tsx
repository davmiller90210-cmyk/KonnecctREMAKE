import { useLingui } from '@lingui/react/macro';

import { ChatConversationListBody } from '@/chat/components/ChatConversationListBody';
import { ChatSidebarFrame } from '@/chat/ui/sidebar/ChatSidebarFrame';
import { IconX } from 'twenty-ui/display';
import { LightIconButton } from 'twenty-ui/input';

type ChatConversationListPanelProps = {
  onMobileNavigate?: () => void;
};

export const ChatConversationListPanel = ({
  onMobileNavigate,
}: ChatConversationListPanelProps) => {
  const { t } = useLingui();

  return (
    <ChatSidebarFrame
      mobileHeader={
        <>
          <span>{t`Conversations`}</span>
          {onMobileNavigate ? (
            <LightIconButton
              Icon={IconX}
              accent="tertiary"
              size="small"
              aria-label={t`Close list`}
              onClick={onMobileNavigate}
            />
          ) : null}
        </>
      }
    >
      <ChatConversationListBody
        variant="pageColumn"
        onAfterNavigate={onMobileNavigate}
      />
    </ChatSidebarFrame>
  );
};
