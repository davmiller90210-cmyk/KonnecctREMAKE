import { useCallback, useEffect, useState } from 'react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type ChatWorkspaceMemberOption } from '@/chat/types/chat-workspace-layout.type';

const StyledBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledPanel = styled.div`
  width: 100%;
  max-width: 420px;
  border-radius: ${themeCssVariables.border.radius.md};
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  padding: ${themeCssVariables.spacing[5]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  font-family: ${themeCssVariables.font.family};
`;

const StyledLabel = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledMemberList = styled.div`
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
`;

const StyledMemberButton = styled.button<{ isSelected: boolean }>`
  display: block;
  width: 100%;
  text-align: left;
  padding: ${themeCssVariables.spacing[3]};
  border: none;
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  background: ${({ isSelected }) =>
    isSelected
      ? themeCssVariables.background.transparent.medium
      : 'transparent'};
  cursor: pointer;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

type NewDmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  token: string | undefined;
  onCreated: (threadId: string) => void;
  onLayoutRefresh: () => void;
};

export const NewDmModal = ({
  isOpen,
  onClose,
  token,
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

  if (!isOpen) {
    return null;
  }

  return (
    <StyledBackdrop
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <StyledPanel onClick={(e) => e.stopPropagation()}>
        <StyledLabel>{t`Start a direct message with…`}</StyledLabel>
        <StyledMemberList>
          {members.length === 0 ? (
            <div
              style={{
                padding: themeCssVariables.spacing[3],
                fontSize: 12,
                color: themeCssVariables.font.color.tertiary,
              }}
            >
              {t`No other members in this workspace`}
            </div>
          ) : (
            members.map((m) => {
              const label = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;

              return (
                <StyledMemberButton
                  key={m.userWorkspaceId}
                  type="button"
                  isSelected={selectedId === m.userWorkspaceId}
                  onClick={() => setSelectedId(m.userWorkspaceId)}
                >
                  {label}
                  {m.email ? (
                    <span
                      style={{
                        display: 'block',
                        fontSize: 11,
                        color: themeCssVariables.font.color.tertiary,
                        marginTop: 2,
                      }}
                    >
                      {m.email}
                    </span>
                  ) : null}
                </StyledMemberButton>
              );
            })
          )}
        </StyledMemberList>

        {error && (
          <div
            style={{
              color: themeCssVariables.color.red5,
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: themeCssVariables.spacing[2],
            justifyContent: 'flex-end',
          }}
        >
          <Button title={t`Cancel`} variant="secondary" onClick={onClose} />
          <Button
            title={submitting ? t`Opening…` : t`Open`}
            variant="primary"
            accent="blue"
            disabled={submitting || !selectedId}
            onClick={() => void handleSubmit()}
          />
        </div>
      </StyledPanel>
    </StyledBackdrop>
  );
};
