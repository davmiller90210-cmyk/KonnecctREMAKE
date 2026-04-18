import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';

import { useSendbirdCallsOptional } from '@/chat/providers/SendbirdCallsProvider';
import { Button } from 'twenty-ui/input';
import {
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledSubtitle = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  margin-top: ${themeCssVariables.spacing[2]};
`;

/**
 * Incoming 1:1 call prompt — uses the same Modal shell as the rest of Twenty CRM.
 */
export const IncomingCallDialog = () => {
  const { t } = useLingui();
  const ctx = useSendbirdCallsOptional();
  const incoming = ctx?.incomingCall ?? null;

  if (!ctx || !incoming) {
    return null;
  }

  const name =
    incoming.remoteUser?.nickname?.trim() ||
    incoming.remoteUser?.userId ||
    t`Unknown`;

  return (
    <Modal
      isOpen
      size="small"
      padding="medium"
      modalZIndex={10001}
      backdropZIndex={10000}
      onBackdropMouseDown={() => ctx.declineIncoming()}
    >
      <ModalHeader hasBorderBottom>
        <StyledTitle>{t`Incoming call`}</StyledTitle>
      </ModalHeader>
      <ModalContent gap={4}>
        <StyledSubtitle>
          {incoming.isVideoCall ? t`Video` : t`Voice`} · {name}
        </StyledSubtitle>
      </ModalContent>
      <ModalFooter>
        <Button
          title={t`Decline`}
          variant="secondary"
          onClick={() => ctx.declineIncoming()}
        />
        <Button
          title={t`Accept`}
          variant="primary"
          accent="blue"
          onClick={() => ctx.acceptIncoming()}
        />
      </ModalFooter>
    </Modal>
  );
};
