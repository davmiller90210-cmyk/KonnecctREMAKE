import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';

import { type ChatWorkspaceLayoutResponse } from '@/chat/types/chat-workspace-layout.type';
import {
  IconLock,
  IconMessage,
  IconSearch,
  IconUsers,
  type IconComponent,
} from 'twenty-ui/display';
import {
  Modal,
  ModalContent,
  ModalHeader,
} from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledSearchWrap = styled.div`
  padding: 0 ${themeCssVariables.spacing[4]}
    ${themeCssVariables.spacing[3]};
  position: relative;
`;

const StyledSearchIcon = styled.span`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  left: ${themeCssVariables.spacing[6]};
  pointer-events: none;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
`;

const StyledSearchInput = styled.input`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.pill};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  height: 44px;
  outline: none;
  padding: 0 ${themeCssVariables.spacing[4]} 0 40px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  width: 100%;

  &:focus {
    border-color: ${themeCssVariables.color.blue};
    box-shadow: 0 0 0 3px ${themeCssVariables.background.transparent.blue};
  }

  &::placeholder {
    color: ${themeCssVariables.font.color.tertiary};
  }
`;

const StyledList = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  max-height: min(52vh, 420px);
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[2]} 0;
`;

const StyledRow = styled.button<{ $active: boolean }>`
  align-items: flex-start;
  background: ${({ $active }) =>
    $active
      ? themeCssVariables.background.transparent.blue
      : 'transparent'};
  border: none;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
  text-align: left;
  transition: background 0.1s ease;
  width: 100%;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledIconWrap = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  flex-shrink: 0;
  margin-top: 1px;
`;

const StyledTextBlock = styled.span`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const StyledPrimary = styled.span`
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledSecondary = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[6]} ${themeCssVariables.spacing[4]};
  text-align: center;
`;

const StyledHint = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

type QuickRow = {
  key: string;
  path: string;
  title: string;
  kind: 'channel' | 'dm';
  categoryLabel: string | null;
  Icon: IconComponent;
  searchBlob: string;
};

const buildRows = (layout: ChatWorkspaceLayoutResponse): QuickRow[] => {
  const rows: QuickRow[] = [];

  for (const category of layout.categories) {
    const catLabel = category.name?.trim() || '';
    for (const channel of category.channels) {
      if (!channel.canRead) {
        continue;
      }
      const title = channel.name || channel.slug;
      rows.push({
        key: `c:${channel.id}`,
        path: `/chat/c/${channel.id}`,
        title,
        kind: 'channel',
        categoryLabel: catLabel.length > 0 ? catLabel : null,
        Icon: channel.visibility === 'private' ? IconLock : IconMessage,
        searchBlob: `${title} ${channel.slug} ${catLabel}`.toLowerCase(),
      });
    }
  }

  for (const dm of layout.directThreads) {
    const title = dm.title?.trim() ?? '';
    rows.push({
      key: `dm:${dm.id}`,
      path: `/chat/dm/${dm.id}`,
      title: title.length > 0 ? title : '—',
      kind: 'dm',
      categoryLabel: null,
      Icon: dm.kind === 'group' ? IconUsers : IconMessage,
      searchBlob: `${title} dm direct message`.toLowerCase(),
    });
  }

  return rows;
};

type ChatQuickSwitcherProps = {
  isOpen: boolean;
  onClose: () => void;
  layout: ChatWorkspaceLayoutResponse | null;
  onAfterNavigate?: () => void;
};

export const ChatQuickSwitcher = ({
  isOpen,
  onClose,
  layout,
  onAfterNavigate,
}: ChatQuickSwitcherProps) => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const allRows = useMemo(
    () => (layout ? buildRows(layout) : []),
    [layout],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) {
      return allRows;
    }
    return allRows.filter((row) => row.searchBlob.includes(q));
  }, [allRows, query]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }
    setQuery('');
    setActiveIndex(0);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex((i) => {
      if (filtered.length === 0) {
        return 0;
      }
      return Math.min(i, filtered.length - 1);
    });
  }, [filtered.length]);

  useLayoutEffect(() => {
    if (!isOpen || filtered.length === 0) {
      return;
    }
    const row = filtered[activeIndex];
    if (!row) {
      return;
    }
    const safeId = `chat-qs-${row.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    document.getElementById(safeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, filtered, isOpen]);

  const go = useCallback(
    (path: string) => {
      navigate(path);
      onAfterNavigate?.();
      onClose();
    },
    [navigate, onAfterNavigate, onClose],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (filtered.length === 0) {
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter') {
        const row = filtered[activeIndex];
        if (row) {
          e.preventDefault();
          go(row.path);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, filtered, go, isOpen, onClose]);

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
        <StyledTitle>{t`Jump to conversation`}</StyledTitle>
      </ModalHeader>
      <ModalContent gap={0}>
        <StyledSearchWrap>
          <StyledSearchIcon>
            <IconSearch size={18} stroke={1.6} />
          </StyledSearchIcon>
          <StyledSearchInput
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t`Search channels and people`}
            aria-label={t`Search channels and people`}
          />
        </StyledSearchWrap>

        <StyledList aria-label={t`Conversations`}>
          {!layout ? (
            <StyledEmpty>{t`Loading workspace…`}</StyledEmpty>
          ) : filtered.length === 0 ? (
            <StyledEmpty>{t`No matches`}</StyledEmpty>
          ) : (
            filtered.map((row, index) => (
              <StyledRow
                key={row.key}
                id={`chat-qs-${row.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`}
                type="button"
                $active={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => go(row.path)}
              >
                <StyledIconWrap>
                  <row.Icon size={20} stroke={1.75} />
                </StyledIconWrap>
                <StyledTextBlock>
                  <StyledPrimary>
                    {row.kind === 'dm' && row.title === '—'
                      ? t`Direct message`
                      : row.title}
                  </StyledPrimary>
                  {row.kind === 'channel' && row.categoryLabel ? (
                    <StyledSecondary>{row.categoryLabel}</StyledSecondary>
                  ) : row.kind === 'dm' && row.title !== '—' ? (
                    <StyledSecondary>{t`Direct message`}</StyledSecondary>
                  ) : null}
                </StyledTextBlock>
              </StyledRow>
            ))
          )}
        </StyledList>
        <StyledHint>
          {t`↑↓ to navigate · Enter to open · Esc to close · Ctrl/⌘ + K to toggle · Ctrl + Shift + G to open`}
        </StyledHint>
      </ModalContent>
    </Modal>
  );
};
