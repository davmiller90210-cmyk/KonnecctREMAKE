import { useCallback, useEffect, useMemo, useState } from 'react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Button } from 'twenty-ui/input';
import { Avatar, IconSearch } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { ChatModalShell } from '@/chat/components/ChatModalShell';
import { type ChatWorkspaceMemberOption } from '@/chat/types/chat-workspace-layout.type';

const StyledSearchWrap = styled.div`
  position: relative;
`;

const StyledSearchInput = styled.input`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  outline: none;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[2]}
    ${themeCssVariables.spacing[2]} 36px;
  width: 100%;

  &:focus {
    border-color: ${themeCssVariables.border.color.strong};
  }
`;

const StyledSearchIcon = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  left: 10px;
  pointer-events: none;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
`;

const StyledMemberList = styled.div`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  max-height: 280px;
  overflow-y: auto;
`;

const StyledMemberButton = styled.button<{ $selected: boolean }>`
  align-items: center;
  background: ${({ $selected }) =>
    $selected
      ? themeCssVariables.background.transparent.medium
      : 'transparent'};
  border: none;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[3]};
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

const StyledMemberTextCol = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const StyledMemberPrimary = styled.span`
  font-weight: ${themeCssVariables.font.weight.medium};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledMemberSecondary = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledMuted = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledError = styled.div`
  color: ${themeCssVariables.color.red5};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
  margin-top: ${themeCssVariables.spacing[1]};
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

  return (
    <ChatModalShell
      isOpen={isOpen}
      maxWidth={480}
      title={t`New direct message`}
      onClose={onClose}
    >
      <StyledSearchWrap>
        <StyledSearchIcon>
          <IconSearch size={themeCssVariables.icon.size.sm} />
        </StyledSearchIcon>
        <StyledSearchInput
          autoFocus
          placeholder={t`Search by name or email…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
                <Avatar
                  placeholder={label}
                  placeholderColorSeed={sid}
                  size="sm"
                />
                <StyledMemberTextCol>
                  <StyledMemberPrimary>{label}</StyledMemberPrimary>
                  {m.email ? (
                    <StyledMemberSecondary>{m.email}</StyledMemberSecondary>
                  ) : null}
                </StyledMemberTextCol>
              </StyledMemberButton>
            );
          })
        )}
      </StyledMemberList>

      {error ? <StyledError>{error}</StyledError> : null}

      <StyledActions>
        <Button title={t`Cancel`} variant="secondary" onClick={onClose} />
        <Button
          accent="blue"
          disabled={submitting || !selectedStreamId}
          title={submitting ? t`Opening…` : t`Open chat`}
          variant="primary"
          onClick={() => void handleSubmit()}
        />
      </StyledActions>
    </ChatModalShell>
  );
};
