import StarRating from "./StarRating";
import {
  MAX_TARGET_TENTHS,
  MIN_TARGET_TENTHS,
  MIX_AVG_TENTHS,
  TargetPlan,
} from "../lib/target";

function monthsText(months: number): string {
  if (months < 1) {
    return "less than a month";
  }

  const rounded = Math.round(months);

  return rounded === 1 ? "about 1 month" : `about ${rounded} months`;
}

export default function RatingHeader({
  businessName,
  average,
  total,
  distribution,
  plan,
  exact,
  onTargetChange,
}: {
  businessName: string;
  average: number;
  total: number;
  distribution: number[];
  plan: TargetPlan;
  exact: boolean;
  onTargetChange: (tenths: number) => void;
}) {
  const t10 = plan.targetTenths;
  const target = (t10 / 10).toFixed(1);
  const maxCount = Math.max(1, ...distribution);

  if (total === 0) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#FFD84D]">
          Your Google rating
        </p>
        {businessName && (
          <p className="mt-1 text-sm text-white/60">{businessName}</p>
        )}
        <p className="mt-4 text-2xl font-bold text-white">
          No reviews yet
        </p>
        <p className="mt-2 max-w-md text-sm text-white/60">
          Your rating and goal calculator appear here as soon as your
          business has its first Google review.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1.1fr] md:gap-12">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#FFD84D]">
          Your Google rating
        </p>

        {businessName && (
          <p className="mt-1 text-sm text-white/60">{businessName}</p>
        )}

        <div className="mt-4 flex items-end gap-5">
          <span
            data-testid="rating-number"
            className="text-7xl font-extrabold leading-none tracking-tight md:text-8xl"
            style={{ color: "#FFD84D" }}
          >
            {average.toFixed(1)}
          </span>

          <div className="pb-1.5">
            <StarRating value={average} size={30} />
            <p className="mt-1.5 text-sm text-white/70">
              {total.toLocaleString("en-IN")} Google{" "}
              {total === 1 ? "review" : "reviews"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex max-w-sm flex-col gap-1.5">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = distribution[stars - 1] ?? 0;

            return (
              <div key={stars} className="flex items-center gap-3 text-xs">
                <span className="w-3 text-white/70">{stars}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(count / maxCount) * 100}%`,
                      background:
                        "linear-gradient(90deg, #FFD84D, #F2A100)",
                    }}
                  />
                </div>
                <span className="w-8 text-right text-white/50">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-white/15 bg-white/5 p-5 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Rating goal</p>
            <p className="text-xs text-white/50">
              Choose the rating you want to reach
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              aria-label="Lower the goal"
              onClick={() => onTargetChange(t10 - 1)}
              disabled={t10 <= MIN_TARGET_TENTHS}
              className="h-9 w-9 rounded-lg border border-white/25 text-lg text-white transition hover:border-white/60 disabled:opacity-30"
            >
              {"\u2212"}
            </button>

            <span
              data-testid="target-value"
              className="min-w-16 text-center text-3xl font-extrabold text-white"
            >
              {target}
            </span>

            <button
              aria-label="Raise the goal"
              onClick={() => onTargetChange(t10 + 1)}
              disabled={t10 >= MAX_TARGET_TENTHS}
              className="h-9 w-9 rounded-lg border border-white/25 text-lg text-white transition hover:border-white/60 disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-5 border-t border-white/10 pt-5">
          {plan.alreadyThere ? (
            <div data-testid="plan-already">
              <p className="text-lg font-bold" style={{ color: "#7CF0A8" }}>
                You are already at or above {target}.
              </p>
              <p className="mt-2 text-sm text-white/70">
                You can absorb up to{" "}
                <span className="font-bold text-white">
                  {plan.negativesAfter === null
                    ? "any number of"
                    : plan.negativesAfter.toLocaleString("en-IN")}
                </span>{" "}
                one-star reviews before you slip below {target}.
              </p>
            </div>
          ) : (
            <div data-testid="plan-needed">
              <p className="text-sm text-white/60">To reach {target} you need</p>
              <p className="mt-1">
                <span
                  data-testid="five-stars-needed"
                  className="text-5xl font-extrabold text-white"
                >
                  +{plan.fiveStars.toLocaleString("en-IN")}
                </span>{" "}
                <span className="text-lg font-semibold text-white/80">
                  five-star {plan.fiveStars === 1 ? "review" : "reviews"}
                </span>
              </p>

              {plan.mixed !== null && (
                <p className="mt-1 text-sm text-white/60">
                  or +{plan.mixed.toLocaleString("en-IN")} if your new
                  reviews average {(MIX_AVG_TENTHS / 10).toFixed(1)} stars
                </p>
              )}

              {plan.months !== null && plan.pace !== null && (
                <p className="mt-3 text-sm text-white/70">
                  At your recent pace of{" "}
                  <span className="font-semibold text-white">
                    {plan.pace} reviews a month
                  </span>
                  , that is {monthsText(plan.months)}
                  {plan.monthsBasis === "five"
                    ? " (if every review is 5 stars)."
                    : "."}
                </p>
              )}

              <p className="mt-3 text-sm text-white/70">
                Once you get there you can absorb up to{" "}
                <span className="font-bold text-white">
                  {plan.negativesAfter === null
                    ? "any number of"
                    : plan.negativesAfter.toLocaleString("en-IN")}
                </span>{" "}
                one-star reviews before slipping back below {target}.
              </p>
            </div>
          )}
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
            What one bad review costs at {target}
          </p>

          <div className="mt-2 grid grid-cols-4 gap-2">
            {plan.offsets.map((o) => (
              <div
                key={o.stars}
                className="rounded-lg bg-white/5 px-2 py-2 text-center"
              >
                <p className="text-xs text-white/60">{o.stars}{"\u2605"}</p>
                <p className="text-sm font-bold text-white">
                  {o.fiveStarReviews === 0 ? "none" : `${o.fiveStarReviews} \u00d7 5\u2605`}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-5 text-xs leading-5 text-white/40">
          {exact
            ? "Worked out from every star rating on your profile."
            : "Estimated from Google's rounded average, so treat the numbers as approximate."}{" "}
          Goals stop at 4.9, because a perfect 5.0 is not realistic. Ask
          every customer for a review, never choose who to ask, and never
          offer anything in return.
        </p>
      </div>
    </div>
  );
}
