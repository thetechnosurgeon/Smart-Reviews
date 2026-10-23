import type { ReactNode } from "react";

import StarRating from "./StarRating";
import {
  MAX_TARGET_TENTHS,
  MIN_TARGET_TENTHS,
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
  const recent = plan.rows.find((row) => row.isRecent);

  return (
    <div>
      <div className="biz-row">
        <div>
          <p className="eyebrow">Google business</p>

          <h1 data-testid="business-name" className="biz-name">
            {businessName || "Your business"}
          </h1>
        </div>

        {action}
      </div>

      {total === 0 ? (
        <div style={{ marginTop: 72 }}>
          <p className="goal-done" style={{ color: "#fff" }}>
            No reviews yet
          </p>
          <p className="goal-foot" style={{ maxWidth: 440 }}>
            Your rating and goal appear here as soon as this business
            has its first Google review.
          </p>
        </div>
      ) : (
        <div className="rate-grid">
          <div>
            <p className="rate-cap">Google rating</p>

            <div className="rate-line">
              <span data-testid="rating-number" className="rate-num">
                {average.toFixed(1)}
              </span>

              <div className="rate-meta">
                <StarRating value={average} size={28} />
                <p className="rate-count">
                  {total.toLocaleString("en-IN")} Google{" "}
                  {total === 1 ? "review" : "reviews"}
                </p>
              </div>
            </div>

            <div className="bars">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = distribution[stars - 1] ?? 0;

                return (
                  <div key={stars} className="bar">
                    <span>{stars}</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="goal">
            <div className="goal-head">
              <div>
                <p className="goal-title">Rating goal</p>
                <p className="goal-sub">Pick the rating you want to reach</p>
              </div>

              <div className="stepper">
                <button
                  aria-label="Lower the goal"
                  onClick={() => onTargetChange(t10 - 1)}
                  disabled={t10 <= MIN_TARGET_TENTHS}
                >
                  {"\u2212"}
                </button>

                <span data-testid="target-value" className="goal-val">
                  {target}
                </span>

                <button
                  aria-label="Raise the goal"
                  onClick={() => onTargetChange(t10 + 1)}
                  disabled={t10 >= MAX_TARGET_TENTHS}
                >
                  +
                </button>
              </div>
            </div>

            {plan.alreadyThere ? (
              <div data-testid="plan-already">
                <p className="goal-done">You have already reached {target}.</p>

                {plan.holdShare !== null && (
                  <p className="goal-foot">
                    To hold it, at least {plan.holdShare}% of new reviews
                    should be 5{"\u2605"}. Your other reviews average{" "}
                    {plan.mix.othersAvg.toFixed(1)}
                    {"\u2605"}.
                  </p>
                )}
              </div>
            ) : (
              <div data-testid="plan-needed">
                <p className="goal-ask">
                  To reach {target}, if this share of new reviews is 5
                  {"\u2605"}:
                </p>

                <ul className="goal-rows">
                  {plan.rows.map((row) => (
                    <li key={row.share}>
                      <div>
                        <span className="st">
                          {row.share}% of new reviews
                        </span>

                        {row.isRecent && (
                          <small className="tag">
                            your last {plan.mix.sample} reviews
                          </small>
                        )}
                      </div>

                      {row.fiveStars === null ? (
                        <span
                          data-testid={`needed-${row.share}`}
                          className="no"
                        >
                          Not reachable
                        </span>
                      ) : (
                        <span
                          data-testid={`needed-${row.share}`}
                          className={row.isRecent ? "yes big" : "yes"}
                        >
                          +{row.fiveStars.toLocaleString("en-IN")}
                          <small>
                            five-star{" "}
                            {row.fiveStars === 1 ? "review" : "reviews"}
                          </small>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {recent && recent.total !== null ? (
                  <p className="goal-foot" data-testid="plan-summary">
                    At your recent mix that is about{" "}
                    {recent.total.toLocaleString("en-IN")} new reviews in all
                    {recent.months !== null && plan.pace !== null
                      ? `, or ${monthsText(recent.months)} at your recent pace of ${plan.pace} reviews a month`
                      : ""}
                    .
                  </p>
                ) : (
                  <>
                    <p className="goal-warn" data-testid="plan-unreachable">
                      At your recent mix, new reviews average{" "}
                      {plan.mixAverage.toFixed(2)}
                      {"\u2605"}, below your {target} goal, so more reviews
                      alone will not get you there.
                    </p>

                    {plan.neededShare !== null && (
                      <p className="goal-foot">
                        You need at least {plan.neededShare}% of new reviews
                        to be 5{"\u2605"} (you are at {plan.mix.share}%).
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {!exact && (
              <p className="goal-foot">
                Estimated from Google&apos;s rounded average.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
