import { useCallback, useEffect, useMemo, useState } from 'react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Button } from 'twenty-ui/input';
import {
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type ChatWorkspaceMemberOption } from '@/chat/types/chat-workspace-layout.type';

const StyledModalTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledLabel = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledMemberList = styled.div`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  max-height: 220px;
  overflow-y: auto;
`;

const StyledMemberButton = styled.button<{ isSelected: boolean }>`
  background: ${({ isSelected }) =>
    isSelected
      ? themeCssVariables.background.transparent.medium
      : 'transparent'};
  border: none;
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: block;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[3]};
  text-align: left;
  width: 100%;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledEmptyHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledEmailHint = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  display: block;
  font-size: ${themeCssVariables.font.size.xs};
  margin-top: 2px;
`;

const StyledErrorText = styled.div`
  color: ${themeCssVariables.color.red5};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
`;

type NewDmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  token: string | undefined;
  viewerUserWorkspaceId: string | undefined;
  onCreated: (threadId: string) => void;
  onLayoutRefresh: () => void;
};

export const NewDmModal = ({
  isOpen,
  onClose,
  token,
  viewerUserWorkspaceId,
  onCreated,
  onLayoutRefresh,
}: NewDmModalProps) => {
  const [members, setMembers] = useState<ChatWorkspaceMemberOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !token) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/chat/workspace-members', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data = (await response.json()) as ChatWorkspaceMemberOption[];

        if (!cancelled) {
          setMembers(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setMembers([]);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, token]);

  const selectableMembers = useMemo(
    () =>
      members.filter((m) => m.userWorkspaceId !== viewerUserWorkspaceId),
    [members, viewerUserWorkspaceId],
  );

  const handleSubmit = useCallback(async () => {
    if (!token || !selectedId) {
      setError(t`Select a teammate`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/chat/dm/direct', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ peerUserWorkspaceId: selectedId }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as { threadId: string };
      onLayoutRefresh();
      onCreated(data.threadId);
      setSelectedId(null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [token, selectedId, onClose, onCreated, onLayoutRefresh]);

  return (
    <Modal
      isOpen={isOpen}
      size="medium"
      padding="none"
      modalZIndex={10000}
      backdropZIndex={9999}
      onBackdropMouseDown={onClose}
    >
      <ModalHeader hasBorderBottom>
        <StyledModalTitle>{t`New direct message`}</StyledModalTitle>
      </ModalHeader>
      <ModalContent gap={4}>
        <StyledLabel>{t`Start a direct message with…`}</StyledLabel>
        <StyledMemberList>
          {selectableMembers.length === 0 ? (
            <StyledEmptyHint>
              {t`No other members in this workspace`}
            </StyledEmptyHint>
          ) : (
            selectableMembers.map((m) => {
              const label =
                [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;

              return (
                <StyledMemberButton
                  key={m.userWorkspaceId}
                  type="button"
                  isSelected={selectedId === m.userWorkspaceId}
                  onClick={() => setSelectedId(m.userWorkspaceId)}
                >
                  {label}
                  {m.email ? (
                    <StyledEmailHint>{m.email}</StyledEmailHint>
                  ) : null}
                </StyledMemberButton>
              );
            })
          )}
        </StyledMemberList>

        {error ? <StyledErrorText>{error}</StyledErrorText> : null}
      </ModalContent>
      <ModalFooter>
        <Button title={t`Cancel`} variant="secondary" onClick={onClose} />
        <Button
          title={submitting ? t`Opening…` : t`Open`}
          variant="primary"
          accent="blue"
          disabled={submitting || !selectedId}
          onClick={() => void handleSubmit()}
        />
      </ModalFooter>
    </Modal>
  );
};
