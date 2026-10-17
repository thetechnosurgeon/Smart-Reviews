import type { ReactNode } from "react";

import StarRating from "./StarRating";
import {
  MAX_TARGET_TENTHS,
  MIN_TARGET_TENTHS,
  TargetPlan,
} from "../lib/target";

export default function RatingHeader({
  businessName,
  average,
  total,
  distribution,
  plan,
  exact,
  onTargetChange,
  action,
}: {
  businessName: string;
  average: number;
  total: number;
  distribution: number[];
  plan: TargetPlan;
  exact: boolean;
  onTargetChange: (tenths: number) => void;
  action?: ReactNode;
}) {
  const t10 = plan.targetTenths;
  const target = (t10 / 10).toFixed(1);
  const maxCount = Math.max(1, ...distribution);
  const someImpossible = plan.needed.some((row) => row.count === null);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#FFD84D]">
            Google business
          </p>

          <h2
            data-testid="business-name"
            className="mt-1 break-words text-3xl font-extrabold leading-tight tracking-tight text-white md:text-5xl"
          >
            {businessName || "Your business"}
          </h2>
        </div>

        {action}
      </div>

      {total === 0 ? (
        <div className="mt-8">
          <p className="text-2xl font-bold text-white">No reviews yet</p>
          <p className="mt-2 max-w-md text-sm text-white/60">
            Your rating and goal appear here as soon as this business
            has its first Google review.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_1.1fr] md:gap-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Google rating
            </p>

            <div className="mt-3 flex items-end gap-5">
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
                  <div
                    key={stars}
                    className="flex items-center gap-3 text-xs"
                  >
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
                    <span className="w-8 text-right text-white/50">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/5 p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  Rating goal
                </p>
                <p className="text-xs text-white/50">
                  Pick the rating you want to reach
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
                <p
                  data-testid="plan-already"
                  className="text-lg font-bold"
                  style={{ color: "#7CF0A8" }}
                >
                  You have already reached {target}.
                </p>
              ) : (
                <div data-testid="plan-needed">
                  <p className="text-sm text-white/60">
                    To reach {target}, if every new review were:
                  </p>

                  <ul className="mt-3 flex flex-col gap-2">
                    {plan.needed.map((row) => (
                      <li
                        key={row.stars}
                        className="flex items-center justify-between gap-4 rounded-xl bg-white/5 px-4 py-3"
                      >
                        <span
                          className="text-lg font-bold"
                          style={{ color: "#FFD84D" }}
                        >
                          {row.stars}
                          {"\u2605"}
                        </span>

                        {row.count === null ? (
                          <span
                            data-testid={`needed-${row.stars}`}
                            className="text-sm text-white/45"
                          >
                            Not possible
                          </span>
                        ) : (
                          <span
                            data-testid={`needed-${row.stars}`}
                            className={
                              row.stars === 5
                                ? "text-2xl font-extrabold text-white"
                                : "text-lg font-bold text-white"
                            }
                          >
                            +{row.count.toLocaleString("en-IN")}{" "}
                            <span className="text-sm font-medium text-white/60">
                              {row.count === 1 ? "review" : "reviews"}
                            </span>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {someImpossible && (
                    <p className="mt-3 text-xs leading-5 text-white/50">
                      Reviews rated below {target} pull your average
                      down, so only higher-rated reviews can lift it.
                    </p>
                  )}
                </div>
              )}
            </div>

            {!exact && (
              <p className="mt-4 text-xs text-white/40">
                Estimated from Google&apos;s rounded average.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
