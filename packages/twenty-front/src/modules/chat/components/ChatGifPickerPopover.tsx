import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useRef, useState } from 'react';

import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledPopover = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  left: ${themeCssVariables.spacing[3]};
  max-width: min(360px, calc(100vw - 24px));
  padding: ${themeCssVariables.spacing[2]};
  position: absolute;
  right: ${themeCssVariables.spacing[3]};
  bottom: calc(100% + ${themeCssVariables.spacing[1]});
  z-index: 45;
`;

const StyledSearch = styled.input`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  outline: none;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  width: 100%;

  &:focus {
    border-color: ${themeCssVariables.color.blue};
  }
`;

const StyledGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[1]};
  grid-template-columns: repeat(3, minmax(0, 1fr));
  max-height: 280px;
  overflow-y: auto;
`;

const StyledThumb = styled.button`
  aspect-ratio: 1;
  background: ${themeCssVariables.background.transparent.light};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  overflow: hidden;
  padding: 0;
  width: 100%;

  &:hover {
    outline: 2px solid ${themeCssVariables.color.blue};
  }

  img {
    display: block;
    height: 100%;
    object-fit: cover;
    width: 100%;
  }
`;

const StyledHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[1]} 0;
`;

const StyledError = styled.div`
  color: ${themeCssVariables.color.red};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
`;

export type ChatGiphyGifDTO = {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
};

type ChatGifPickerPopoverProps = {
  token: string;
  onPick: (gif: ChatGiphyGifDTO) => void;
  onClose: () => void;
};

const SEARCH_DEBOUNCE_MS = 320;

export const ChatGifPickerPopover = ({
  token,
  onPick,
  onClose,
}: ChatGifPickerPopoverProps) => {
  const { t } = useLingui();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ChatGiphyGifDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const loadTrending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/chat/gifs/trending?limit=24', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text.trim() || `HTTP ${response.status}`);
      }
      const data = (await response.json()) as ChatGiphyGifDTO[];
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setItems([]);
      setError(
        e instanceof Error ? e.message : t`Could not load GIFs`,
      );
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  const loadSearch = useCallback(
    async (q: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: '24' });
        if (q.trim()) {
          params.set('q', q.trim());
        }
        const response = await fetch(`/chat/gifs/search?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text.trim() || `HTTP ${response.status}`);
        }
        const data = (await response.json()) as ChatGiphyGifDTO[];
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        setItems([]);
        setError(
          e instanceof Error ? e.message : t`Could not search GIFs`,
        );
      } finally {
        setLoading(false);
      }
    },
    [t, token],
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    const q = query.trim();
    const delay = q.length === 0 ? 0 : SEARCH_DEBOUNCE_MS;
    debounceRef.current = setTimeout(() => {
      if (q.length === 0) {
        void loadTrending();
      } else {
        void loadSearch(q);
      }
    }, delay);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [loadSearch, loadTrending, query]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const node = wrapRef.current;
      if (node && !node.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [onClose]);

  return (
    <StyledPopover ref={wrapRef} role="dialog" aria-label={t`GIF picker`}>
      <StyledSearch
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t`Search GIPHY…`}
        autoFocus
      />
      {error ? <StyledError>{error}</StyledError> : null}
      {!error && loading && items.length === 0 ? (
        <StyledHint>{t`Loading…`}</StyledHint>
      ) : null}
      {!error && !loading && items.length === 0 ? (
        <StyledHint>{t`No GIFs found.`}</StyledHint>
      ) : null}
      <StyledGrid>
        {items.map((gif) => (
          <StyledThumb
            key={gif.id}
            type="button"
            title={gif.title}
            onClick={() => onPick(gif)}
          >
            <img src={gif.previewUrl} alt="" loading="lazy" />
          </StyledThumb>
        ))}
      </StyledGrid>
      <StyledHint>
        {t`Powered by GIPHY — results and imagery are subject to GIPHY’s terms.`}
      </StyledHint>
    </StyledPopover>
  );
};
