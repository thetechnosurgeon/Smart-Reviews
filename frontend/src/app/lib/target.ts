// Rating-goal maths. Everything works in whole numbers (ratings in tenths of a
// star) so there are no floating-point surprises such as "81 reviews" when the
// true answer is 80.

export const MIN_TARGET_TENTHS = 30;
export const MAX_TARGET_TENTHS = 49; // 5.0 is not a sensible goal, so goals stop at 4.9
export const DEFAULT_TARGET_TENTHS = 47;
export const MIX_AVG_TENTHS = 48; // "realistic" new reviews average 4.8 stars

export type RatingStats = {
  n: number; // number of reviews
  sum: number; // total stars across all reviews
  exact: boolean; // false when we had to estimate from Google's rounded average
  average: number; // the rating to display (Google's own number when we have it)
};

export function buildStats(
  ratings: number[],
  apiAverage?: number | null,
  apiTotal?: number | null
): RatingStats {
  const valid = ratings.filter((r) => r >= 1 && r <= 5);
  const loadedSum = valid.reduce((a, r) => a + r, 0);
  const total =
    typeof apiTotal === "number" && apiTotal > 0 ? apiTotal : null;
  const avg =
    typeof apiAverage === "number" && apiAverage > 0 ? apiAverage : null;

  if (valid.length > 0 && (total === null || valid.length >= total)) {
    return {
      n: valid.length,
      sum: loadedSum,
      exact: true,
      average: avg ?? loadedSum / valid.length,
    };
  }

  if (avg !== null && total !== null) {
    return {
      n: total,
      sum: Math.round(avg * total),
      exact: false,
      average: avg,
    };
  }

  if (valid.length > 0) {
    return {
      n: valid.length,
      sum: loadedSum,
      exact: true,
      average: loadedSum / valid.length,
    };
  }

  return { n: 0, sum: 0, exact: true, average: 0 };
}

export function starCounts(ratings: number[]): number[] {
  const counts = [0, 0, 0, 0, 0]; // index 0..4 = 1..5 stars

  for (const r of ratings) {
    if (r >= 1 && r <= 5) {
      counts[r - 1] += 1;
    }
  }

  return counts;
}

// How far below the goal we are, in "tenth-star reviews". <= 0 means at or above.
function shortfall(sum: number, n: number, t10: number): number {
  return t10 * n - 10 * sum;
}

// New reviews needed if every one of them is 5 stars.
export function fiveStarsNeeded(sum: number, n: number, t10: number): number {
  const d = shortfall(sum, n, t10);

  return d <= 0 ? 0 : Math.ceil(d / (50 - t10));
}

// New reviews needed if the new reviews average m10 tenths of a star.
// null = impossible (new reviews can never lift you above their own average).
export function reviewsNeededAtAverage(
  sum: number,
  n: number,
  t10: number,
  m10: number
): number | null {
  const d = shortfall(sum, n, t10);

  if (d <= 0) {
    return 0;
  }

  const den = m10 - t10;

  return den <= 0 ? null : Math.ceil(d / den);
}

// How many reviews of `stars` stars can arrive before the average drops below
// the goal. 0 = already below. null = unlimited (they could never pull it under).
export function negativesAfforded(
  sum: number,
  n: number,
  t10: number,
  stars: number = 1
): number | null {
  const slack = 10 * sum - t10 * n;

  if (slack < 0) {
    return 0;
  }

  const den = t10 - 10 * stars;

  return den <= 0 ? null : Math.floor(slack / den);
}

// Five-star reviews needed to cancel out ONE review of `stars` stars.
export function offsetCost(t10: number, stars: number): number {
  const num = t10 - 10 * stars;

  return num <= 0 ? 0 : Math.ceil(num / (50 - t10));
}

export type TargetPlan = {
  targetTenths: number;
  alreadyThere: boolean;
  fiveStars: number;
  mixed: number | null;
  months: number | null;
  monthsBasis: "mixed" | "five";
  negativesAfter: number | null; // 1-star reviews you can absorb once the goal is reached
  offsets: { stars: number; fiveStarReviews: number }[];
  pace: number | null;
};

export function clampTarget(t10: number): number {
  const safe = Number.isFinite(t10) ? Math.round(t10) : DEFAULT_TARGET_TENTHS;

  return Math.min(MAX_TARGET_TENTHS, Math.max(MIN_TARGET_TENTHS, safe));
}

export function planFor(
  stats: RatingStats,
  targetTenths: number,
  pacePerMonth: number | null
): TargetPlan {
  const t10 = clampTarget(targetTenths);
  const x = fiveStarsNeeded(stats.sum, stats.n, t10);
  const alreadyThere = x === 0;
  const mixed = alreadyThere
    ? 0
    : reviewsNeededAtAverage(stats.sum, stats.n, t10, MIX_AVG_TENTHS);

  const negativesAfter = negativesAfforded(
    stats.sum + 5 * x,
    stats.n + x,
    t10,
    1
  );

  let months: number | null = null;
  let monthsBasis: "mixed" | "five" = "mixed";

  if (!alreadyThere && pacePerMonth !== null && pacePerMonth > 0) {
    const basis = mixed ?? x;

    monthsBasis = mixed !== null ? "mixed" : "five";
    months = basis / pacePerMonth;
  }

  return {
    targetTenths: t10,
    alreadyThere,
    fiveStars: x,
    mixed,
    months,
    monthsBasis,
    negativesAfter,
    offsets: [1, 2, 3, 4].map((stars) => ({
      stars,
      fiveStarReviews: offsetCost(t10, stars),
    })),
    pace: pacePerMonth,
  };
}

// Reviews per month over the last 90 days, from the reviews already loaded.
export function recentPace(
  created: (string | null | undefined)[],
  nowMs: number = Date.now(),
  days: number = 90
): number | null {
  const cutoff = nowMs - days * 24 * 60 * 60 * 1000;
  let count = 0;

  for (const c of created) {
    if (!c) {
      continue;
    }

    const t = new Date(c).getTime();

    if (!Number.isNaN(t) && t >= cutoff && t <= nowMs + 24 * 60 * 60 * 1000) {
      count += 1;
    }
  }

  return count === 0 ? null : Math.round((count / (days / 30)) * 10) / 10;
}

export function defaultTargetTenths(average: number): number {
  const current = Math.round(average * 10);

  return current < DEFAULT_TARGET_TENTHS
    ? DEFAULT_TARGET_TENTHS
    : Math.min(MAX_TARGET_TENTHS, current + 1);
}

const storageKey = (locationId: string) =>
  `smartrepute:target:${locationId}`;

export function readStoredTarget(locationId: string, average: number): number {
  try {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(storageKey(locationId));

      if (raw !== null) {
        const value = Number(raw);

        if (Number.isFinite(value)) {
          return clampTarget(value);
        }
      }
    }
  } catch {
    // storage can be blocked -- fall back to the default
  }

  return defaultTargetTenths(average);
}

export function storeTarget(locationId: string, t10: number): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey(locationId), String(t10));
    }
  } catch {
    // ignore
  }
}
