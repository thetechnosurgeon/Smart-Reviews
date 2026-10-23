// Rating-goal maths. Everything works in whole numbers (ratings in tenths of a
// star) so there are no floating-point surprises such as "81 reviews" when the
// true answer is 80.

export const MIN_TARGET_TENTHS = 30;
export const MAX_TARGET_TENTHS = 49; // 5.0 is not a sensible goal, so goals stop at 4.9
export const DEFAULT_TARGET_TENTHS = 47;

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

export function clampTarget(t10: number): number {
  const safe = Number.isFinite(t10) ? Math.round(t10) : DEFAULT_TARGET_TENTHS;

  return Math.min(MAX_TARGET_TENTHS, Math.max(MIN_TARGET_TENTHS, safe));
}

// ---------------------------------------------------------------------------
// The mix of ratings a business actually gets.
//
// A real business cannot receive only 5-star reviews, so the goal maths works
// from the business's OWN recent mix: what share of new reviews are 5 stars,
// and what the other reviews average. Everything is kept in whole numbers:
//   share  = whole percent (0-100)
//   others = hundredths of a star
//   the "scaled" averages below are in stars x 10,000
// ---------------------------------------------------------------------------

export type Mix = {
  share: number; // % of recent reviews that are 5 stars
  othersAvg: number; // average of the recent reviews that are NOT 5 stars
  sample: number; // how many reviews this is based on
};

const DAY_MS = 24 * 60 * 60 * 1000;

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function recentMix(
  items: { rating: number; created?: string | null }[],
  nowMs: number = Date.now()
): Mix | null {
  const valid = items.filter((r) => r.rating >= 1 && r.rating <= 5);

  if (valid.length === 0) {
    return null;
  }

  const dated = valid.map((r) => ({
    rating: r.rating,
    t: r.created ? new Date(r.created).getTime() : Number.NaN,
  }));

  // Prefer the last 90 days; with too few, the latest 30; else everything.
  let window = dated.filter(
    (r) =>
      !Number.isNaN(r.t) && r.t >= nowMs - 90 * DAY_MS && r.t <= nowMs + DAY_MS
  );

  if (window.length < 10) {
    const latest = dated
      .filter((r) => !Number.isNaN(r.t))
      .sort((x, y) => y.t - x.t)
      .slice(0, 30);

    window = latest.length >= 10 ? latest : dated;
  }

  const fives = window.filter((r) => r.rating === 5).length;

  // The "other" reviews: recent ones if there are enough, else all-time.
  const recentOthers = window.filter((r) => r.rating < 5);
  const pool =
    recentOthers.length >= 3 ? recentOthers : valid.filter((r) => r.rating < 5);

  const othersAvg = pool.length
    ? round2(pool.reduce((acc, r) => acc + r.rating, 0) / pool.length)
    : 4.0;

  return {
    share: Math.round((100 * fives) / window.length),
    othersAvg,
    sample: window.length,
  };
}

// Average rating of new reviews, scaled by 10,000, when `share` percent are
// 5 stars and the rest average `others100` hundredths of a star.
function mixScaled(share: number, others100: number): number {
  return 500 * share + others100 * (100 - share);
}

// New reviews needed to reach the goal at this mix. null = the mix itself
// averages at or below the goal, so no number of reviews can get there.
export function reviewsNeededAtMix(
  sum: number,
  n: number,
  t10: number,
  share: number,
  othersAvg: number
): number | null {
  const shortfall = 1000 * t10 * n - 10000 * sum; // > 0 means below the goal

  if (shortfall <= 0) {
    return 0;
  }

  const den = mixScaled(share, Math.round(othersAvg * 100)) - 1000 * t10;

  return den <= 0 ? null : Math.ceil(shortfall / den);
}

// Smallest whole-percent share of 5-star reviews at which new reviews average
// ABOVE the goal (strict = able to reach it) or AT/ABOVE it (able to hold it).
// null = no requirement: the other reviews alone already clear the goal.
export function minShare(
  t10: number,
  othersAvg: number,
  strict: boolean
): number | null {
  const others100 = Math.round(othersAvg * 100);
  const gap = 1000 * t10 - 100 * others100; // what the 5-star share must make up
  const per = 500 - others100; // gain per percentage point of 5-star share

  if (gap < 0 || (gap === 0 && !strict)) {
    return null;
  }

  const p = strict ? Math.floor(gap / per) + 1 : Math.ceil(gap / per);

  return Math.min(100, Math.max(0, p));
}

export type GoalRow = {
  share: number; // % of new reviews that are 5 stars in this scenario
  isRecent: boolean; // true for the business's own recent mix
  fiveStars: number | null; // 5-star reviews needed; null = not reachable
  total: number | null; // all new reviews needed at this mix
  months: number | null; // at the recent pace of reviews per month
};

export type TargetPlan = {
  targetTenths: number;
  alreadyThere: boolean;
  rows: GoalRow[];
  mix: Mix;
  mixAverage: number; // what new reviews average at the recent mix
  neededShare: number | null; // 5-star share needed to be able to reach the goal
  holdShare: number | null; // 5-star share needed to hold the goal once reached
  pace: number | null;
};

export const DEFAULT_MIX: Mix = { share: 85, othersAvg: 4.0, sample: 0 };

export function planFor(
  stats: RatingStats,
  targetTenths: number,
  pacePerMonth: number | null,
  mixIn: Mix | null
): TargetPlan {
  const t10 = clampTarget(targetTenths);
  const mix = mixIn ?? DEFAULT_MIX;
  const alreadyThere = 1000 * t10 * stats.n - 10000 * stats.sum <= 0;
  const others100 = Math.round(mix.othersAvg * 100);

  // The business's own mix, then the next round-number scenarios above it.
  const shares = [mix.share, 90, 95, 100]
    .filter((p) => p >= mix.share)
    .filter((p, i, all) => all.indexOf(p) === i);

  const rows: GoalRow[] = shares.map((share) => {
    const total = alreadyThere
      ? 0
      : reviewsNeededAtMix(stats.sum, stats.n, t10, share, mix.othersAvg);

    if (total === null) {
      return {
        share,
        isRecent: share === mix.share,
        fiveStars: null,
        total: null,
        months: null,
      };
    }

    return {
      share,
      isRecent: share === mix.share,
      fiveStars: share === 100 ? total : Math.round((total * share) / 100),
      total,
      months:
        !alreadyThere && pacePerMonth !== null && pacePerMonth > 0
          ? total / pacePerMonth
          : null,
    };
  });

  return {
    targetTenths: t10,
    alreadyThere,
    rows,
    mix,
    mixAverage: mixScaled(mix.share, others100) / 10000,
    neededShare: minShare(t10, mix.othersAvg, true),
    holdShare: minShare(t10, mix.othersAvg, false),
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
