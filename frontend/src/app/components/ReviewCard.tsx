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

const TONE_STYLE: Record<CardTone, { backgroundColor: string; borderColor: string }> = {
  white: {
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(11, 12, 16, 0.10)",
  },
  mist: {
    backgroundColor: "#F6F9FE",
    borderColor: "#E1E9F6",
  },
  mint: {
    backgroundColor: "#EAF7EE",
    borderColor: "#BDE4CA",
  },
  paper: {
    backgroundColor: "#F7F8FA",
    borderColor: "rgba(11, 12, 16, 0.08)",
  },
  muted: {
    backgroundColor: "rgba(11, 12, 16, 0.035)",
    borderColor: "rgba(11, 12, 16, 0.10)",
  },
};

// Badge colours match the tiles at the top of the page:
// needs reply = yellow, reply ready = orange, approved = green, replied = gold.
function Badge({ status }: { status?: string }) {
  let label = "Needs reply";
  let cls = "bg-[#FFD84D]/40 text-[#7A5A00]";

  if (status === "generating") {
    label = "Generating\u2026";
    cls = "bg-[#1957C9]/10 text-[#1957C9] animate-pulse";
  } else if (status === "draft") {
    label = "Reply ready";
    cls = "bg-[#F97316]/15 text-[#C2410C]";
  } else if (status === "approved") {
    label = "Approved";
    cls = "bg-[#16A34A] text-white";
  } else if (status === "posted") {
    label = "Replied";
    cls = "bg-[#F2A100]/20 text-[#9A6400]";
  } else if (status === "skipped") {
    label = "Skipped";
    cls = "bg-black/10 text-black/60";
  }

  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  );
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

  return (
    <article
      data-tone={tone}
      className="grid gap-6 rounded-2xl border p-6 shadow-sm md:grid-cols-[200px_1fr] md:p-7"
      style={TONE_STYLE[tone]}
    >
      <div>
        <p className="text-sm font-semibold text-[#0B0C10]">
          {review.reviewer}
        </p>

        <div className="mt-3 text-base tracking-wide">
          <span style={{ color: "#F5B700" }}>{"\u2605".repeat(stars)}</span>
          <span className="text-black/15">{"\u2605".repeat(5 - stars)}</span>
        </div>

        {review.rating <= 2 && !posted && (
          <p className="mt-3 text-xs font-semibold text-red-600">
            Needs attention
          </p>
        )}

        <div className="mt-4">
          <Badge status={status} />
        </div>
      </div>

      <div>
        <p className="max-w-3xl text-lg leading-8 text-[#0B0C10] md:text-xl">
          {review.review
            ? `\u201c${review.review}\u201d`
            : "No written comment"}
        </p>

        {review.existing_reply && posted && (
          <div className="mt-6 border-l-2 border-[#F2A100]/60 pl-5">
            <p className="text-xs font-medium text-[#5A6B86]">
              Existing reply from Google
            </p>

            <p className="mt-2 text-[15px] leading-7 text-black/65">
              {review.existing_reply}
            </p>

            <button
              onClick={() => onSaveExample("existing")}
              disabled={savedExisting}
              className="mt-3 text-xs font-semibold text-[#1957C9] underline-offset-2 hover:underline disabled:text-[#5A6B86] disabled:no-underline"
            >
              {savedExisting ? "Saved as example" : "Save as style example"}
            </button>
          </div>
        )}

        {!reply && !posted && (
          <button
            onClick={onGenerate}
            disabled={generating}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#1957C9] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B3A8C] disabled:opacity-50"
          >
            {generating ? "Generating\u2026" : "Generate reply"}
            <ArrowIcon />
          </button>
        )}

        {reply && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-[#15803D]">
              {posted ? "Posted reply" : "Suggested reply"}
            </p>

            <textarea
              value={reply}
              onChange={(e) => onEdit(e.target.value)}
              disabled={posted}
              className="min-h-36 w-full resize-y rounded-xl border border-black/15 bg-white p-4 text-[15px] leading-6 focus:border-[#1957C9] focus:outline-none disabled:bg-white/70"
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={onApprove}
                disabled={posted || status === "approved"}
                className="inline-flex items-center gap-2 rounded-lg bg-[#16A34A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#15803D] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "approved" ? "Approved" : "Approve"}
                {status !== "approved" && <ArrowIcon />}
              </button>

              <button
                onClick={onSkip}
                disabled={posted}
                className="rounded-lg border border-black/15 bg-white px-5 py-2.5 text-sm font-medium transition hover:bg-black/5 disabled:opacity-30"
              >
                Skip
              </button>

              <button
                onClick={onGenerate}
                disabled={posted || generating}
                className="px-2 py-2.5 text-sm font-medium text-[#5A6B86] transition hover:text-[#0B0C10] disabled:opacity-30"
              >
                Regenerate
              </button>

              {posted && (
                <button
                  onClick={() => onSaveExample("own")}
                  disabled={savedOwn}
                  className="px-2 py-2.5 text-sm font-semibold text-[#1957C9] disabled:text-[#5A6B86]"
                >
                  {savedOwn ? "Saved as example" : "Save as style example"}
                </button>
              )}
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </article>
  );
}
