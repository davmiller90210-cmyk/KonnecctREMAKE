import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useAtomValue } from 'jotai';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { type ChatWorkspaceLayoutResponse } from '@/chat/types/chat-workspace-layout.type';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { IconMessage } from 'twenty-ui/display';
import { LightIconButton } from 'twenty-ui/input';
import { MenuItem } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledSectionLabel = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: 0.05em;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[2]}
    ${themeCssVariables.spacing[1]};
  text-transform: uppercase;
`;

type RecordPageChatMenuProps = {
  objectNameSingular: string;
  objectRecordId: string;
};

type RecordLinkRow = {
  conversationKind: 'channel' | 'dm';
  conversationId: string;
  title: string;
  linkedAt: string;
};

type PostableChannel = { id: string; name: string };

type RecordMenuDataPhase = 'pristine' | 'loading' | 'ready';

type RecordPageChatMenuDropdownProps = RecordPageChatMenuProps & {
  dataPhase: RecordMenuDataPhase;
  postableChannels: PostableChannel[];
  links: RecordLinkRow[] | null;
};

const parseChatApiError = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  try {
    const body = (await response.clone().json()) as {
      message?: string | string[];
    };
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message.trim();
    }
    if (Array.isArray(body.message) && body.message.length > 0) {
      return body.message.map(String).join(', ');
    }
  } catch {
    // ignore
  }
  return fallback;
};

const RecordPageChatMenuDropdown = ({
  objectNameSingular,
  objectRecordId,
  dataPhase,
  postableChannels,
  links,
}: RecordPageChatMenuDropdownProps) => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { closeDropdown } = useCloseDropdown();
  const tokenPair = useAtomValue(tokenPairState.atom);
  const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();

  const recordQuery = `recordObjectName=${encodeURIComponent(objectNameSingular)}&recordId=${encodeURIComponent(objectRecordId)}`;

  const openChatHome = () => {
    closeDropdown();
    navigate(`/chat?${recordQuery}`);
  };

  const startDiscussionChannel = async () => {
    if (!token) {
      return;
    }
    try {
      const response = await fetch('/chat/records/discussion-channel', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          objectNameSingular,
          recordId: objectRecordId,
        }),
      });
      if (!response.ok) {
        const msg = await parseChatApiError(
          response,
          t`Unable to create discussion channel`,
        );
        throw new Error(msg);
      }
      const data = (await response.json()) as { channelId: string };
      enqueueSuccessSnackBar({ message: t`Discussion channel created` });
      closeDropdown();
      navigate(`/chat/c/${data.channelId}?${recordQuery}`);
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : t`Could not create channel`,
      });
    }
  };

  const startDmWithOwner = async () => {
    if (!token) {
      return;
    }
    try {
      const response = await fetch('/chat/records/dm-with-owner', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          objectNameSingular,
          recordId: objectRecordId,
        }),
      });
      if (!response.ok) {
        const msg = await parseChatApiError(
          response,
          t`Could not open direct message`,
        );
        throw new Error(msg);
      }
      const data = (await response.json()) as { dmThreadId: string };
      enqueueSuccessSnackBar({ message: t`Opening direct message` });
      closeDropdown();
      navigate(`/chat/dm/${data.dmThreadId}?${recordQuery}`);
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : t`Could not message record owner`,
      });
    }
  };

  const shareSnippet = () => {
    const snippet =
      typeof window !== 'undefined'
        ? window.getSelection()?.toString().trim()
        : '';
    const fallback = t`Regarding this record:`;
    const draft = snippet && snippet.length > 0 ? snippet : fallback;
    closeDropdown();
    navigate(`/chat?${recordQuery}&messageDraft=${encodeURIComponent(draft)}`);
  };

  const openLinked = (row: RecordLinkRow) => {
    closeDropdown();
    const q = recordQuery;
    if (row.conversationKind === 'channel') {
      navigate(`/chat/c/${row.conversationId}?${q}`);
    } else {
      navigate(`/chat/dm/${row.conversationId}?${q}`);
    }
  };

  const openChannelWithContext = (channelId: string) => {
    closeDropdown();
    const draft = t`Regarding this record — `;
    navigate(
      `/chat/c/${channelId}?${recordQuery}&messageDraft=${encodeURIComponent(draft)}`,
    );
  };

  return (
    <DropdownContent
      widthInPixels={GenericDropdownContentWidth.ExtraLarge}
    >
      <StyledSectionLabel>{t`Record chat`}</StyledSectionLabel>
      <DropdownMenuItemsContainer>
        <MenuItem
          text={t`Open chat`}
          LeftIcon={IconMessage}
          onClick={() => {
            openChatHome();
          }}
        />
        <MenuItem
          text={t`Start discussion channel`}
          onClick={() => {
            void startDiscussionChannel();
          }}
        />
        <MenuItem
          text={t`Message record owner`}
          onClick={() => {
            void startDmWithOwner();
          }}
        />
        <MenuItem
          text={t`Share snippet to chat`}
          onClick={() => {
            shareSnippet();
          }}
        />
      </DropdownMenuItemsContainer>

      {dataPhase !== 'pristine' ? (
        <>
          <StyledSectionLabel>{t`Post to channel`}</StyledSectionLabel>
          <DropdownMenuItemsContainer>
            {dataPhase === 'loading' ? (
              <MenuItem text={t`Loading channels…`} disabled />
            ) : postableChannels.length > 0 ? (
              postableChannels.map((ch) => (
                <MenuItem
                  key={ch.id}
                  text={`#${ch.name}`}
                  onClick={() => {
                    openChannelWithContext(ch.id);
                  }}
                />
              ))
            ) : (
              <MenuItem
                text={t`No channels you can post in`}
                disabled
              />
            )}
          </DropdownMenuItemsContainer>
        </>
      ) : null}

      {dataPhase !== 'pristine' ? (
        <>
          <StyledSectionLabel>{t`Linked conversations`}</StyledSectionLabel>
          <DropdownMenuItemsContainer>
            {dataPhase === 'loading' ? (
              <MenuItem text={t`Loading linked chats…`} disabled />
            ) : (links ?? []).length > 0 ? (
              (links ?? []).map((row) => (
                <MenuItem
                  key={`${row.conversationKind}-${row.conversationId}`}
                  text={row.title}
                  onClick={() => {
                    openLinked(row);
                  }}
                />
              ))
            ) : (
              <MenuItem
                text={t`No linked conversations yet`}
                disabled
              />
            )}
          </DropdownMenuItemsContainer>
        </>
      ) : null}
    </DropdownContent>
  );
};

export const RecordPageChatMenu = ({
  objectNameSingular,
  objectRecordId,
}: RecordPageChatMenuProps) => {
  const { t } = useLingui();
  const tokenPair = useAtomValue(tokenPairState.atom);
  const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const [links, setLinks] = useState<RecordLinkRow[] | null>(null);
  const [postableChannels, setPostableChannels] = useState<PostableChannel[]>(
    [],
  );
  const [menuDataPhase, setMenuDataPhase] =
    useState<RecordMenuDataPhase>('pristine');
  const menuDataLoadGenerationRef = useRef(0);

  const loadMenuData = useCallback(
    async (generation: number) => {
      if (!token) {
        if (menuDataLoadGenerationRef.current !== generation) {
          return;
        }
        setLinks([]);
        setPostableChannels([]);
        setMenuDataPhase('ready');
        return;
      }
      const params = new URLSearchParams({
        objectNameSingular,
        recordId: objectRecordId,
      });

      try {
        const [linksRes, layoutRes] = await Promise.all([
          fetch(`/chat/record-links?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/chat/layout', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (menuDataLoadGenerationRef.current !== generation) {
          return;
        }

        if (linksRes.ok) {
          const data = (await linksRes.json()) as { links: RecordLinkRow[] };
          setLinks(data.links ?? []);
        } else {
          setLinks([]);
        }

        if (layoutRes.ok) {
          const layout = (await layoutRes.json()) as ChatWorkspaceLayoutResponse;
          const channels = layout.categories
            .flatMap((c) => c.channels)
            .filter((ch) => ch.canRead && ch.canPost)
            .slice(0, 24)
            .map((ch) => ({ id: ch.id, name: ch.name }));
          setPostableChannels(channels);
        } else {
          setPostableChannels([]);
        }
      } finally {
        if (menuDataLoadGenerationRef.current === generation) {
          setMenuDataPhase('ready');
        }
      }
    },
    [objectNameSingular, objectRecordId, token],
  );

  const dropdownId = `record-chat-menu-${objectNameSingular}-${objectRecordId}`;

  return (
    <Dropdown
      dropdownId={dropdownId}
      dropdownPlacement="bottom-end"
      onOpen={() => {
        menuDataLoadGenerationRef.current += 1;
        const generation = menuDataLoadGenerationRef.current;
        setMenuDataPhase('loading');
        setLinks(null);
        setPostableChannels([]);
        void loadMenuData(generation);
      }}
      onClose={() => {
        menuDataLoadGenerationRef.current += 1;
        setMenuDataPhase('pristine');
        setLinks(null);
        setPostableChannels([]);
      }}
      clickableComponent={
        <LightIconButton
          Icon={IconMessage}
          accent="tertiary"
          size="medium"
          aria-label={t`Chat about this record`}
        />
      }
      dropdownComponents={
        <RecordPageChatMenuDropdown
          objectNameSingular={objectNameSingular}
          objectRecordId={objectRecordId}
          dataPhase={menuDataPhase}
          postableChannels={postableChannels}
          links={links}
        />
      }
    />
  );
};
