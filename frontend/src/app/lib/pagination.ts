export const PAGE_SIZE = 25;

export function pageCount(total: number, size: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

// Keeps a page number valid even when the list shrinks (e.g. after posting).
export function clampPage(
  page: number,
  total: number,
  size: number = PAGE_SIZE
): number {
  const safe = Number.isFinite(page) ? Math.floor(page) : 1;

  return Math.min(Math.max(1, safe), pageCount(total, size));
}

export function pageSlice<T>(
  items: T[],
  page: number,
  size: number = PAGE_SIZE
): T[] {
  const current = clampPage(page, items.length, size);

  return items.slice((current - 1) * size, current * size);
}

// 1-based, inclusive range of what is on screen: "Showing 26-50 of 61".
export function pageRange(
  total: number,
  page: number,
  size: number = PAGE_SIZE
): { start: number; end: number } {
  if (total === 0) {
    return { start: 0, end: 0 };
  }

  const current = clampPage(page, total, size);

  return {
    start: (current - 1) * size + 1,
    end: Math.min(total, current * size),
  };
}
