import { useEffect, useState } from 'react';

import { useIsMobile } from '@/ui/utilities/responsive/hooks/useIsMobile';

const NARROW_QUERY = '(max-width: 1100px)';

export const useChatResponsiveLayout = () => {
  const isMobile = useIsMobile();
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mq = window.matchMedia(NARROW_QUERY);
    const update = () => setIsNarrow(mq.matches);

    update();
    mq.addEventListener('change', update);

    return () => mq.removeEventListener('change', update);
  }, []);

  return { isMobile, isNarrowDesktop: isNarrow };
};
