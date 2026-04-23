import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';

import {
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from 'twenty-ui/layout';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledModalTitle = styled.h2`
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

const StyledTextarea = styled.textarea`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  line-height: 1.45;
  min-height: 100px;
  outline: none;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  resize: vertical;
  width: 100%;

  &:focus {
    border-color: ${themeCssVariables.color.blue};
  }
`;

type ChatEditMessageModalProps = {
  isOpen: boolean;
  initialBody: string;
  onClose: () => void;
  onSave: (body: string) => Promise<void>;
};

export const ChatEditMessageModal = ({
  isOpen,
  initialBody,
  onClose,
  onSave,
}: ChatEditMessageModalProps) => {
  const { t } = useLingui();
  const [value, setValue] = useState(initialBody);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValue(initialBody);
    }
  }, [isOpen, initialBody]);

  if (!isOpen) {
    return null;
  }

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed || saving) {
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      size="small"
      padding="none"
      modalZIndex={10000}
      backdropZIndex={9999}
      onBackdropMouseDown={onClose}
    >
      <ModalHeader hasBorderBottom>
        <StyledModalTitle>{t`Edit message`}</StyledModalTitle>
      </ModalHeader>
      <ModalContent gap={3}>
        <StyledTextarea
          aria-label={t`Message text`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
      </ModalContent>
      <ModalFooter>
        <Button title={t`Cancel`} variant="secondary" onClick={onClose} />
        <Button
          title={saving ? t`Saving…` : t`Save`}
          variant="primary"
          accent="blue"
          disabled={saving || !value.trim()}
          onClick={() => void handleSave()}
        />
      </ModalFooter>
    </Modal>
  );
};
