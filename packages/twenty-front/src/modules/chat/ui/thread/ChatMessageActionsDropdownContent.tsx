import { useLingui } from '@lingui/react/macro';

import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { MenuItem } from 'twenty-ui/navigation';

type ChatMessageActionsDropdownContentProps = {
  textToCopy: string;
  showCopy: boolean;
  isPinned: boolean;
  canPin: boolean;
  onPin?: () => Promise<void>;
  onUnpin?: () => Promise<void>;
  onEdit?: () => void;
  onDelete?: () => void;
};

export const ChatMessageActionsDropdownContent = ({
  textToCopy,
  showCopy,
  isPinned,
  canPin,
  onPin,
  onUnpin,
  onEdit,
  onDelete,
}: ChatMessageActionsDropdownContentProps) => {
  const { t } = useLingui();
  const { closeDropdown } = useCloseDropdown();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } finally {
      closeDropdown();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      enqueueSuccessSnackBar({ message: t`Copied to clipboard` });
    } catch {
      enqueueErrorSnackBar({ message: t`Could not copy` });
    }
    closeDropdown();
  };

  const showPin = Boolean(onPin && canPin && !isPinned);
  const showUnpin = Boolean(onUnpin && isPinned);

  return (
    <DropdownContent>
      <DropdownMenuItemsContainer>
        {showCopy ? (
          <MenuItem
            text={t`Copy text`}
            onClick={() => {
              void handleCopy();
            }}
          />
        ) : null}
        {onEdit ? (
          <MenuItem
            text={t`Edit message`}
            onClick={() => {
              closeDropdown();
              onEdit();
            }}
          />
        ) : null}
        {onDelete ? (
          <MenuItem
            text={t`Delete message`}
            onClick={() => {
              closeDropdown();
              onDelete();
            }}
          />
        ) : null}
        {showPin ? (
          <MenuItem
            text={t`Pin message`}
            onClick={() => {
              void run(onPin!);
            }}
          />
        ) : null}
        {showUnpin ? (
          <MenuItem
            text={t`Unpin message`}
            onClick={() => {
              void run(onUnpin!);
            }}
          />
        ) : null}
      </DropdownMenuItemsContainer>
    </DropdownContent>
  );
};
