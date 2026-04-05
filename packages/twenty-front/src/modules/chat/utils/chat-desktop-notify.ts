export const notifyIncomingChatIfBackground = (options: {
  title: string;
  body: string;
}) => {
  if (typeof window === 'undefined' || document.visibilityState === 'visible') {
    return;
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }

  try {
    new Notification(options.title.trim() || 'Konnecct', {
      body: options.body,
      tag: 'konnecct-chat',
    });
  } catch {
    // Ignore unsupported environments
  }
};

export const requestChatNotificationPermission = () => {
  if (typeof Notification === 'undefined') {
    return Promise.resolve('unsupported' as const);
  }

  if (Notification.permission === 'granted') {
    return Promise.resolve('granted' as const);
  }

  if (Notification.permission === 'denied') {
    return Promise.resolve('denied' as const);
  }

  return Notification.requestPermission();
};
