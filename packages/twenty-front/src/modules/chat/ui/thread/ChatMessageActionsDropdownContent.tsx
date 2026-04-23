import { useLingui } from '@lingui/react/macro';

import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { MenuItem } from 'twenty-ui/navigation';

type ChatMessageActionsDropdownContentProps = {
  isPinned: boolean;
  canPin: boolean;
  onPin: () => Promise<void>;
  onUnpin: () => Promise<void>;
};

export const ChatMessageActionsDropdownContent = ({
  isPinned,
  canPin,
  onPin,
  onUnpin,
}: ChatMessageActionsDropdownContentProps) => {
  const { t } = useLingui();
  const { closeDropdown } = useCloseDropdown();

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } finally {
      closeDropdown();
    }
  };

  return (
    <DropdownContent>
      <DropdownMenuItemsContainer>
        {isPinned ? (
          <MenuItem
            text={t`Unpin message`}
            onClick={() => {
              void run(onUnpin);
            }}
          />
        ) : (
          <MenuItem
            text={t`Pin message`}
            disabled={!canPin}
            onClick={() => {
              if (!canPin) {
                return;
              }
              void run(onPin);
            }}
          />
        )}
      </DropdownMenuItemsContainer>
    </DropdownContent>
  );
};
