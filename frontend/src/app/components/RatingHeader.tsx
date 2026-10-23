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
              <p data-testid="plan-already" className="goal-done">
                You have already reached {target}.
              </p>
            ) : (
              <div data-testid="plan-needed">
                <p className="goal-ask">
                  To reach {target}, if every new review were:
                </p>

                <ul className="goal-rows">
                  {plan.needed.map((row) => (
                    <li key={row.stars}>
                      <span className="st">
                        {row.stars}
                        {"\u2605"}
                      </span>

                      {row.count === null ? (
                        <span data-testid={`needed-${row.stars}`} className="no">
                          Not possible
                        </span>
                      ) : (
                        <span
                          data-testid={`needed-${row.stars}`}
                          className={row.stars === 5 ? "yes big" : "yes"}
                        >
                          +{row.count.toLocaleString("en-IN")}
                          <small>
                            {row.count === 1 ? "review" : "reviews"}
                          </small>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {someImpossible && (
                  <p className="goal-foot">
                    Reviews rated below {target} pull your average down,
                    so only higher-rated reviews can lift it.
                  </p>
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
