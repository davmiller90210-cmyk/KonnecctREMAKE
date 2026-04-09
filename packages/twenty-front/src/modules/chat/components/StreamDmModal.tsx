import { useCallback, useEffect, useMemo, useState } from 'react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Button } from 'twenty-ui/input';
import { IconSearch } from 'twenty-ui/display';
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
  max-width: 440px;
  border-radius: ${themeCssVariables.border.radius.md};
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  padding: ${themeCssVariables.spacing[5]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  font-family: ${themeCssVariables.font.family};
`;

const StyledTitle = styled.div`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledSearchWrap = styled.div`
  position: relative;
`;

const StyledSearchInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[2]}
    ${themeCssVariables.spacing[2]} 36px;
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.secondary};
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  outline: none;

  &:focus {
    border-color: ${themeCssVariables.border.color.strong};
  }
`;

const StyledSearchIcon = styled.div`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: ${themeCssVariables.font.color.tertiary};
  pointer-events: none;
`;

const StyledMemberList = styled.div`
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
`;

const StyledMemberButton = styled.button<{ $selected: boolean }>`
  display: block;
  width: 100%;
  text-align: left;
  padding: ${themeCssVariables.spacing[3]};
  border: none;
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  background: ${({ $selected }) =>
    $selected
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

const StyledMuted = styled.div`
  padding: ${themeCssVariables.spacing[3]};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledError = styled.div`
  color: ${themeCssVariables.color.red5};
  font-size: 12px;
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
`;

type StreamDmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  token: string | undefined;
  currentStreamUserId: string | undefined;
  onStartDm: (peerStreamUserId: string) => void | Promise<void>;
};

export const StreamDmModal = ({
  isOpen,
  onClose,
  token,
  currentStreamUserId,
  onStartDm,
}: StreamDmModalProps) => {
  const [members, setMembers] = useState<ChatWorkspaceMemberOption[]>([]);
  const [query, setQuery] = useState('');
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(
    null,
  );
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

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedStreamId(null);
      setError(null);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return members;
    }
    return members.filter((m) => {
      const label = [m.firstName, m.lastName].filter(Boolean).join(' ');
      const hay = `${label} ${m.email}`.toLowerCase();
      return hay.includes(q);
    });
  }, [members, query]);

  const handleSubmit = useCallback(async () => {
    if (!selectedStreamId) {
      setError(t`Select someone to message`);
      return;
    }

    if (selectedStreamId === currentStreamUserId) {
      setError(t`You cannot DM yourself`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onStartDm(selectedStreamId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [currentStreamUserId, onClose, onStartDm, selectedStreamId]);

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
        <StyledTitle>{t`New direct message`}</StyledTitle>
        <StyledSearchWrap>
          <StyledSearchIcon>
            <IconSearch size={themeCssVariables.icon.size.sm} />
          </StyledSearchIcon>
          <StyledSearchInput
            placeholder={t`Search by name or email…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </StyledSearchWrap>
        <StyledMemberList>
          {filtered.length === 0 ? (
            <StyledMuted>
              {members.length === 0
                ? t`No other members in this workspace`
                : t`No matches`}
            </StyledMuted>
          ) : (
            filtered.map((m) => {
              const label =
                [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;
              const sid = m.streamUserId;

              return (
                <StyledMemberButton
                  key={m.userWorkspaceId}
                  type="button"
                  $selected={selectedStreamId === sid}
                  onClick={() => setSelectedStreamId(sid)}
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

        {error ? <StyledError>{error}</StyledError> : null}

        <StyledActions>
          <Button title={t`Cancel`} variant="secondary" onClick={onClose} />
          <Button
            title={submitting ? t`Opening…` : t`Open chat`}
            variant="primary"
            accent="blue"
            disabled={submitting || !selectedStreamId}
            onClick={() => void handleSubmit()}
          />
        </StyledActions>
      </StyledPanel>
    </StyledBackdrop>
  );
};
