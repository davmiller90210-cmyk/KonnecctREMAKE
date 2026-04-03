import { useCallback, useEffect, useMemo, useState } from 'react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import {
  type ChatWorkspaceLayoutResponse,
  type ChatWorkspaceMemberOption,
} from '@/chat/types/chat-workspace-layout.type';

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

const StyledLabel = styled.label`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
  display: block;
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.secondary};
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledSelect = styled.select`
  width: 100%;
  box-sizing: border-box;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.secondary};
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledRow = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  flex-wrap: wrap;
`;

const StyledMemberList = styled.div`
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledCheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  padding: 4px 0;
`;

type CreateChannelModalProps = {
  isOpen: boolean;
  onClose: () => void;
  token: string | undefined;
  layout: ChatWorkspaceLayoutResponse | null;
  onCreated: (channelId: string) => void;
  onLayoutRefresh: () => void;
};

export const CreateChannelModal = ({
  isOpen,
  onClose,
  token,
  layout,
  onCreated,
  onLayoutRefresh,
}: CreateChannelModalProps) => {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [categoryId, setCategoryId] = useState('');
  const [members, setMembers] = useState<ChatWorkspaceMemberOption[]>([]);
  const [inviteIds, setInviteIds] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = layout?.viewer.isWorkspaceAdmin === true;

  const firstCategoryId = useMemo(() => {
    const first = layout?.categories[0];
    return first?.id ?? '';
  }, [layout]);

  useEffect(() => {
    if (isOpen && firstCategoryId && !categoryId) {
      setCategoryId(firstCategoryId);
    }
  }, [isOpen, firstCategoryId, categoryId]);

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

  const toggleInvite = useCallback((id: string) => {
    setInviteIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!token || !layout) {
      setError(t`Missing session`);
      return;
    }

    const trimmed = name.trim();

    if (!trimmed) {
      setError(t`Channel name is required`);
      return;
    }

    if (!categoryId) {
      setError(t`No category available`);
      return;
    }

    if (visibility === 'public' && !isAdmin) {
      setError(t`Only admins can create public channels`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const inviteUserWorkspaceIds =
        visibility === 'private'
          ? Object.entries(inviteIds)
              .filter(([, v]) => v)
              .map(([k]) => k)
          : undefined;

      const response = await fetch('/chat/channels', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryId,
          name: trimmed,
          visibility,
          inviteUserWorkspaceIds,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as { id: string };
      onLayoutRefresh();
      onCreated(data.id);
      setName('');
      setInviteIds({});
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [
    token,
    layout,
    name,
    categoryId,
    visibility,
    isAdmin,
    inviteIds,
    onClose,
    onCreated,
    onLayoutRefresh,
  ]);

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
        <div>
          <StyledLabel htmlFor="channel-name">{t`Channel name`}</StyledLabel>
          <StyledInput
            id="channel-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t`e.g. announcements`}
            autoFocus
          />
        </div>

        <div>
          <StyledLabel>{t`Category`}</StyledLabel>
          <StyledSelect
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {(layout?.categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </StyledSelect>
        </div>

        <div>
          <StyledLabel>{t`Visibility`}</StyledLabel>
          <StyledRow>
            <label>
              <input
                type="radio"
                name="vis"
                checked={visibility === 'public'}
                disabled={!isAdmin}
                onChange={() => setVisibility('public')}
              />{' '}
              {t`Public`}
            </label>
            <label>
              <input
                type="radio"
                name="vis"
                checked={visibility === 'private'}
                onChange={() => setVisibility('private')}
              />{' '}
              {t`Private`}
            </label>
          </StyledRow>
          {!isAdmin && (
            <div
              style={{
                fontSize: 12,
                color: themeCssVariables.font.color.tertiary,
                marginTop: 8,
              }}
            >
              {t`Only workspace admins can create public channels.`}
            </div>
          )}
        </div>

        {visibility === 'private' && (
          <div>
            <StyledLabel>{t`Invite members`}</StyledLabel>
            <StyledMemberList>
              {members.length === 0 ? (
                <span
                  style={{
                    fontSize: 12,
                    color: themeCssVariables.font.color.tertiary,
                  }}
                >
                  {t`No other members in this workspace`}
                </span>
              ) : (
                members.map((m) => {
                  const label = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;

                  return (
                    <StyledCheckboxRow key={m.userWorkspaceId}>
                      <input
                        type="checkbox"
                        checked={inviteIds[m.userWorkspaceId] === true}
                        onChange={() => toggleInvite(m.userWorkspaceId)}
                      />
                      <span>{label}</span>
                    </StyledCheckboxRow>
                  );
                })
              )}
            </StyledMemberList>
          </div>
        )}

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

        <StyledRow style={{ justifyContent: 'flex-end' }}>
          <Button title={t`Cancel`} variant="secondary" onClick={onClose} />
          <Button
            title={submitting ? t`Creating…` : t`Create`}
            variant="primary"
            accent="blue"
            disabled={submitting}
            onClick={() => void handleSubmit()}
          />
        </StyledRow>
      </StyledPanel>
    </StyledBackdrop>
  );
};
