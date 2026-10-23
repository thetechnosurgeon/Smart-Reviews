"use client";

import ArrowIcon from "./ArrowIcon";

export type CardReview = {
  id: string;
  reviewer: string;
  rating: number;
  review: string;
  existing_reply?: string;
};

export type CardTone = "white" | "mist" | "mint" | "paper" | "muted";

// White until a reply exists, a barely-there blue tint once a reply has been
// drafted, and a soft green once it is approved and ready to post.
export function cardTone(status?: string): CardTone {
  if (status === "draft") {
    return "mist";
  }

  if (status === "approved") {
    return "mint";
  }

  if (status === "posted") {
    return "paper";
  }

  if (status === "skipped") {
    return "muted";
  }

  return "white"; // no reply yet (also while generating, or after an error)
}

// State dot colours match the counters at the top of the page.
function state(status?: string): { label: string; color: string } {
  if (status === "generating") {
    return { label: "Generating\u2026", color: "#2c5fb3" };
  }

  if (status === "draft") {
    return { label: "Reply ready", color: "#d58a3c" };
  }

  if (status === "approved") {
    return { label: "Approved", color: "#3a966a" };
  }

  if (status === "posted") {
    return { label: "Replied", color: "#d8a73a" };
  }

  if (status === "skipped") {
    return { label: "Skipped", color: "#9a9ca0" };
  }

  return { label: "Needs reply", color: "#e2bd4c" };
}

export default function ReviewCard({
  review,
  status,
  reply,
  error,
  savedOwn,
  savedExisting,
  onGenerate,
  onApprove,
  onSkip,
  onEdit,
  onSaveExample,
}: {
  review: CardReview;
  status?: string;
  reply?: string;
  error?: string;
  savedOwn: boolean;
  savedExisting: boolean;
  onGenerate: () => void;
  onApprove: () => void;
  onSkip: () => void;
  onEdit: (value: string) => void;
  onSaveExample: (kind: "own" | "existing") => void;
}) {
  const tone = cardTone(status);
  const stars = Math.max(0, Math.min(5, review.rating));
  const posted = status === "posted";
  const generating = status === "generating";
  const st = state(status);

  return (
    <article className="rv" data-tone={tone}>
      <div>
        <p className="rv-name">{review.reviewer}</p>

        <div className="rv-stars" aria-label={`${stars} out of 5 stars`}>
          {"\u2605".repeat(stars)}
          <i>{"\u2605".repeat(5 - stars)}</i>
        </div>

        {review.rating <= 2 && !posted && (
          <p className="rv-flag">Needs attention</p>
        )}

        <div
          className={`rv-state${generating ? " is-pulsing" : ""}`}
          style={generating ? { opacity: 0.7 } : undefined}
        >
          <span className="dot" style={{ background: st.color }} />
          {st.label}
        </div>
      </div>

      <div>
        <p className="rv-text">
          {review.review
            ? `\u201c${review.review}\u201d`
            : "No written comment"}
        </p>

        {review.existing_reply && posted && (
          <div className="rv-old">
            <small>Existing reply from Google</small>
            <p>{review.existing_reply}</p>

            <button
              className="textbtn"
              style={{ marginTop: 12, fontSize: 13, color: "#2c5fb3" }}
              onClick={() => onSaveExample("existing")}
              disabled={savedExisting}
            >
              {savedExisting ? "Saved as example" : "Save as style example"}
            </button>
          </div>
        )}

        {!reply && !posted && (
          <div className="rv-actions" style={{ marginTop: 28 }}>
            <button
              className="btn btn--blue btn--sm"
              onClick={onGenerate}
              disabled={generating}
            >
              {generating ? "Generating\u2026" : "Generate reply"}
              <ArrowIcon />
            </button>
          </div>
        )}

        {reply && (
          <div>
            <span className="rv-label">
              {posted ? "Posted reply" : "Suggested reply"}
            </span>

            <textarea
              value={reply}
              onChange={(e) => onEdit(e.target.value)}
              disabled={posted}
            />

            <div className="rv-actions">
              <button
                className="btn btn--green btn--sm"
                onClick={onApprove}
                disabled={posted || status === "approved"}
              >
                {status === "approved" ? "Approved" : "Approve"}
                {status !== "approved" && <ArrowIcon />}
              </button>

              <button
                className="btn btn--ghost btn--sm"
                onClick={onSkip}
                disabled={posted}
              >
                Skip
              </button>

              <button
                className="textbtn"
                style={{ fontSize: 13, color: "#5c5e62" }}
                onClick={onGenerate}
                disabled={posted || generating}
              >
                Regenerate
              </button>

              {posted && (
                <button
                  className="textbtn"
                  style={{ fontSize: 13, color: "#2c5fb3" }}
                  onClick={() => onSaveExample("own")}
                  disabled={savedOwn}
                >
                  {savedOwn ? "Saved as example" : "Save as style example"}
                </button>
              )}
            </div>
          </div>
        )}

        {error && <p className="rv-err">{error}</p>}
      </div>
    </article>
  );
}
