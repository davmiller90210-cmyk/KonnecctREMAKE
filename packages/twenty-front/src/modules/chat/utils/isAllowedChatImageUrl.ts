const ALLOWED_CHAT_IMAGE_HOSTS = new Set([
  'media.giphy.com',
  'media0.giphy.com',
  'media1.giphy.com',
  'media2.giphy.com',
  'media3.giphy.com',
  'media4.giphy.com',
  'i.giphy.com',
]);

/**
 * Host allowlist for inline chat images (markdown `![…](url)`), e.g. Giphy CDN.
 */
export const isAllowedChatImageUrl = (href: string): boolean => {
  try {
    const url = new URL(href);

    if (url.protocol !== 'https:') {
      return false;
    }

    return ALLOWED_CHAT_IMAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
};
