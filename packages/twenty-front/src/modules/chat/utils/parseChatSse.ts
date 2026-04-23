/** Minimal SSE frame parser for Konnecct chat streams (one event per `\\n\\n` block). */

export const parseSseEventBlocks = (
  buffer: string,
): { consumed: string; rest: string } => {
  const splitIndex = buffer.indexOf('\n\n');

  if (splitIndex < 0) {
    return { consumed: '', rest: buffer };
  }

  return {
    consumed: buffer.slice(0, splitIndex),
    rest: buffer.slice(splitIndex + 2),
  };
};

export const parseSseBlock = (
  block: string,
): { type: string | null; data: string | null } => {
  if (!block.trim() || block.trimStart().startsWith(':')) {
    return { type: null, data: null };
  }

  let eventType: string | null = null;
  const dataLines: string[] = [];

  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  return {
    type: eventType,
    data: dataLines.length > 0 ? dataLines.join('\n') : null,
  };
};
