const MAX_CONCURRENT = 3;
let active = 0;

/** Limits parallel GraphQL record previews from chat chips. */
export const withChatRecordPreviewSlot = async <T>(
  task: () => Promise<T>,
): Promise<T> => {
  while (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
  }
  active += 1;
  try {
    return await task();
  } finally {
    active -= 1;
  }
};
