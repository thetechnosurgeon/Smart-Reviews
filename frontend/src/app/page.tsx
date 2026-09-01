"use client";

import { useEffect, useState } from "react";

type Review = {
  id: string;
  reviewer: string;
  rating: number;
  review: string;
};

export default function Home() {
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    "https://smart-reviews.onrender.com";

  const GOOGLE_ACCOUNT_ID =
    process.env.NEXT_PUBLIC_GOOGLE_ACCOUNT_ID || "";

  const GOOGLE_LOCATION_ID =
    process.env.NEXT_PUBLIC_GOOGLE_LOCATION_ID || "";

  const [reviews, setReviews] = useState<Review[]>([]);
  const [replies, setReplies] = useState<{ [key: string]: string }>({});
  const [statuses, setStatuses] = useState<{ [key: string]: string }>({});
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    async function loadReviews() {
      try {
        const response = await fetch(`${API_URL}/reviews`);
        const data = await response.json();

        setReviews(data.reviews || []);
      } catch {
        setReviews([]);
      } finally {
        setLoadingReviews(false);
      }
    }

    loadReviews();
  }, [API_URL]);

  async function generateReply(
    reviewId: string,
    reviewText: string
  ) {
    setStatuses((old) => ({
      ...old,
      [reviewId]: "generating",
    }));

    try {
      const response = await fetch(
        `${API_URL}/generate-reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            review: reviewText,
          }),
        }
      );

      const data = await response.json();

      setReplies((old) => ({
        ...old,
        [reviewId]: data.reply,
      }));

      setStatuses((old) => ({
        ...old,
        [reviewId]: "draft",
      }));
    } catch {
      setStatuses((old) => ({
        ...old,
        [reviewId]: "error",
      }));
    }
  }

  async function generateAllReplies() {
    setGeneratingAll(true);

    for (const review of reviews) {
      await generateReply(review.id, review.review);
    }

    setGeneratingAll(false);
  }

  async function approveReply(reviewId: string) {
    try {
      const response = await fetch(
        `${API_URL}/approve-reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            review_id: reviewId,
            reply: replies[reviewId],
          }),
        }
      );

      const data = await response.json();

      setStatuses((old) => ({
        ...old,
        [reviewId]: data.status,
      }));
    } catch {
      setStatuses((old) => ({
        ...old,
        [reviewId]: "error",
      }));
    }
  }

  async function postApprovedReplies() {
    setPosting(true);

    for (const review of reviews) {
      if (statuses[review.id] === "approved") {
        try {
          await fetch(`${API_URL}/post-reply`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              account_id: GOOGLE_ACCOUNT_ID,
              location_id: GOOGLE_LOCATION_ID,
              review_id: review.id,
              reply: replies[review.id],
            }),
          });

          setStatuses((old) => ({
            ...old,
            [review.id]: "posted",
          }));
        } catch {
          setStatuses((old) => ({
            ...old,
            [review.id]: "error",
          }));
        }
      }
    }

    setPosting(false);
  }

  const draftedCount = Object.keys(replies).length;

  const approvedCount = Object.values(statuses).filter(
    (status) => status === "approved"
  ).length;

  const postedCount = Object.values(statuses).filter(
    (status) => status === "posted"
  ).length;

  return (
    <main className="min-h-screen bg-white text-[#171a20]">
      <header className="border-b border-black/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
          <div className="text-lg font-semibold tracking-[-0.02em]">
            Smart Reviews
          </div>

          <div className="hidden text-sm text-black/40 sm:block">
            Review operations
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-20 md:px-10 md:pt-28">
        <div className="max-w-4xl">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-black/35">
            AI-assisted review management
          </p>

          <h1 className="mt-5 text-5xl font-medium leading-[0.95] tracking-[-0.045em] md:text-7xl">
            Every review.
            <br />
            One clear workflow.
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-black/50 md:text-xl">
            Generate thoughtful replies, refine them, approve what matters,
            and publish only when you are ready.
          </p>
        </div>

        <div className="mt-10">
          <button
            onClick={() => {
              window.location.href = `${API_URL}/auth/google`;
            }}
            className="border border-black/20 px-6 py-3 text-sm font-medium transition hover:bg-[#171a20] hover:text-white"
          >
            Connect Google Business Profile
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={generateAllReplies}
            disabled={generatingAll || reviews.length === 0}
            className="bg-[#171a20] px-6 py-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/20"
          >
            {generatingAll
              ? "Generating..."
              : "Generate all replies"}
          </button>

          <button
            onClick={postApprovedReplies}
            disabled={posting || approvedCount === 0}
            className="border border-black/20 px-6 py-3 text-sm font-medium transition hover:border-black hover:bg-[#171a20] hover:text-white disabled:cursor-not-allowed disabled:border-black/10 disabled:text-black/25"
          >
            {posting
              ? "Posting..."
              : approvedCount > 0
              ? `Post approved (${approvedCount})`
              : "Post approved"}
          </button>
        </div>
      </section>

      <section className="border-y border-black/10 bg-[#f5f5f5]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 md:grid-cols-4">
          <Stat label="Reviews" value={reviews.length} />
          <Stat label="Drafted" value={draftedCount} />
          <Stat label="Approved" value={approvedCount} />
          <Stat label="Posted" value={postedCount} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-black/35">
              Inbox
            </p>

            <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em]">
              Reviews
            </h2>
          </div>

          <p className="hidden text-sm text-black/40 md:block">
            Human approval required before posting
          </p>
        </div>

        {loadingReviews ? (
          <div className="border-t border-black/10 py-20 text-sm text-black/40">
            Loading reviews...
          </div>
        ) : reviews.length === 0 ? (
          <div className="border-t border-black/10 py-20">
            <p className="text-lg font-medium">
              No reviews found.
            </p>

            <p className="mt-2 text-sm text-black/40">
              Check that the backend is running and reachable.
            </p>
          </div>
        ) : (
          <div className="border-t border-black/10">
            {reviews.map((review, index) => (
              <article
                key={review.id}
                className="grid gap-8 border-b border-black/10 py-10 md:grid-cols-[180px_1fr] md:py-12"
              >
                <div>
                  <p className="text-sm font-medium">
                    {review.reviewer}
                  </p>

                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-black/35">
                    Review{" "}
                    {String(index + 1).padStart(2, "0")}
                  </p>

                  <div className="mt-5 text-sm tracking-[0.08em]">
                    {"★".repeat(Number(review.rating))}

                    <span className="text-black/15">
                      {"★".repeat(5 - Number(review.rating))}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="max-w-3xl text-xl leading-8 tracking-[-0.01em] md:text-2xl md:leading-9">
                    “{review.review}”
                  </p>

                  {!replies[review.id] && (
                    <button
                      onClick={() =>
                        generateReply(
                          review.id,
                          review.review
                        )
                      }
                      disabled={
                        statuses[review.id] ===
                        "generating"
                      }
                      className="mt-7 border-b border-black pb-1 text-sm font-medium transition hover:opacity-50 disabled:opacity-30"
                    >
                      {statuses[review.id] ===
                      "generating"
                        ? "Generating..."
                        : "Generate reply"}
                    </button>
                  )}

                  {replies[review.id] && (
                    <div className="mt-8">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-black/35">
                          Suggested reply
                        </p>

                        <StatusBadge
                          status={statuses[review.id]}
                        />
                      </div>

                      <textarea
                        value={replies[review.id]}
                        onChange={(e) =>
                          setReplies((old) => ({
                            ...old,
                            [review.id]: e.target.value,
                          }))
                        }
                        className="min-h-36 w-full resize-y border border-black/15 bg-white p-5 text-base leading-7 outline-none transition focus:border-black"
                      />

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          onClick={() =>
                            approveReply(review.id)
                          }
                          disabled={
                            statuses[review.id] ===
                            "posted"
                          }
                          className="bg-[#171a20] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/20"
                        >
                          Approve
                        </button>

                        <button
                          onClick={() =>
                            setStatuses((old) => ({
                              ...old,
                              [review.id]: "skipped",
                            }))
                          }
                          disabled={
                            statuses[review.id] ===
                            "posted"
                          }
                          className="border border-black/15 px-5 py-2.5 text-sm font-medium transition hover:border-black disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          Skip
                        </button>

                        <button
                          onClick={() =>
                            generateReply(
                              review.id,
                              review.review
                            )
                          }
                          disabled={
                            statuses[review.id] ===
                            "posted"
                          }
                          className="px-2 py-2.5 text-sm font-medium text-black/40 transition hover:text-black disabled:cursor-not-allowed disabled:opacity-25"
                        >
                          Regenerate
                        </button>
                      </div>

                      {statuses[review.id] ===
                        "error" && (
                        <p className="mt-4 text-sm text-red-600">
                          Something failed. Check the backend and AI service.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-black/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 text-xs text-black/35 md:flex-row md:items-center md:justify-between md:px-10">
          <span>Smart Reviews</span>
          <span>AI drafts. Human decisions.</span>
        </div>
      </footer>
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="border-r border-black/10 px-6 py-7 last:border-r-0 md:px-8">
      <div className="text-3xl font-medium tracking-[-0.03em]">
        {value}
      </div>

      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-black/35">
        {label}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status?: string;
}) {
  const labels: {
    [key: string]: string;
  } = {
    draft: "Draft",
    approved: "Approved",
    skipped: "Skipped",
    posted: "Posted",
    generating: "Generating",
  };

  if (!status || status === "error") {
    return null;
  }

  return (
    <span className="text-xs font-medium uppercase tracking-[0.14em] text-black/40">
      {labels[status] || status}
    </span>
  );
}