"use client";

import { useEffect, useState } from "react";

type Review = {
  id: string;
  reviewer: string;
  rating: number;
  review: string;
  has_reply?: boolean;
  existing_reply?: string;
};

type Filter =
  | "all"
  | "unanswered"
  | "attention"
  | "draft"
  | "posted";

type RatingFilter =
  | "all"
  | 1
  | 2
  | 3
  | 4
  | 5;

const BATCH_SIZE = 25;

export default function Home() {
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    "https://smart-reviews.onrender.com";

  const [reviews, setReviews] = useState<Review[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [loadingReviews, setLoadingReviews] =
    useState(false);

  const [generatingAll, setGeneratingAll] =
    useState(false);

  const [generationProgress, setGenerationProgress] =
    useState({
      current: 0,
      total: 0,
    });

  const [posting, setPosting] =
    useState(false);

  const [googleConnected, setGoogleConnected] =
    useState(false);

  const [googleAccountId, setGoogleAccountId] =
    useState("");

  const [googleLocationId, setGoogleLocationId] =
    useState("");

  const [googleError, setGoogleError] =
    useState("");

  const [pabblyConnected, setPabblyConnected] =
    useState(false);

  const [filter, setFilter] =
    useState<Filter>("all");

  const [ratingFilter, setRatingFilter] =
    useState<RatingFilter>("all");

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const connected =
      params.get("connected") === "true";

    if (connected) {
      setGoogleConnected(true);
      loadGoogleReviews();
    }
    // Otherwise: wait for the person to click
    // "Fetch Reviews" -- nothing auto-loads.
  }, []);

  function getErrorMessage(
    value: unknown,
    fallback: string
  ) {
    if (value instanceof Error) {
      return value.message;
    }

    if (typeof value === "string") {
      return value;
    }

    return fallback;
  }

  function resetWorkflow() {
    setReplies({});
    setStatuses({});
    setErrors({});
  }

  async function loadDemoReviews() {
    setLoadingReviews(true);
    setGoogleError("");
    resetWorkflow();

    try {
      const response = await fetch(
        `${API_URL}/reviews`
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          data.error ||
            "Unable to load reviews."
        );
      }

      setReviews(
        data.reviews || []
      );
    } catch (error) {
      setReviews([]);

      setGoogleError(
        getErrorMessage(
          error,
          "Unable to load reviews."
        )
      );
    } finally {
      setLoadingReviews(false);
    }
  }

  async function loadGoogleReviews() {
    setLoadingReviews(true);
    setGoogleError("");
    resetWorkflow();

    try {
      const accountResponse = await fetch(
        `${API_URL}/google/accounts`
      );

      const accountData =
        await accountResponse.json();

      if (accountData.error) {
        throw new Error(
          accountData.error?.message ||
          accountData.error?.error?.message ||
          JSON.stringify(accountData.error)
        );
      }

      if (!accountData.accounts?.length) {
        throw new Error(
          "No Google Business Profile accounts found."
        );
      }

      const accountId =
        accountData.accounts[0].name.replace(
          "accounts/",
          ""
        );

      setGoogleAccountId(accountId);

      const locationResponse = await fetch(
        `${API_URL}/google/locations/${accountId}`
      );

      const locationData =
        await locationResponse.json();

      if (locationData.error) {
        throw new Error(
          locationData.error?.message ||
          locationData.error?.error?.message ||
          JSON.stringify(locationData.error)
        );
      }

      if (!locationData.locations?.length) {
        throw new Error(
          "No Google Business Profile locations found."
        );
      }

      const locationId =
        locationData.locations[0].name.replace(
          "locations/",
          ""
        );

      setGoogleLocationId(locationId);

      const reviewResponse = await fetch(
        `${API_URL}/reviews/${accountId}/${locationId}`
      );

      const reviewData =
        await reviewResponse.json();

      if (reviewData.error) {
        throw new Error(
          reviewData.error?.message ||
          reviewData.error?.error?.message ||
          JSON.stringify(reviewData.error)
        );
      }

      const loadedReviews =
        reviewData.reviews || [];

      setReviews(loadedReviews);

      const initialStatuses: Record<string, string> = {};

      for (const review of loadedReviews) {
        if (review.has_reply) {
          initialStatuses[review.id] =
            "posted";
        }
      }

      setStatuses(initialStatuses);
    } catch (error) {
      console.error(error);
      setReviews([]);

      setGoogleError(
        getErrorMessage(
          error,
          "Unable to load Google reviews."
        )
      );
    } finally {
      setLoadingReviews(false);
    }
  }

  async function loadPabblyReviews() {
    setLoadingReviews(true);
    setGoogleError("");
    resetWorkflow();

    try {
      const response = await fetch(
        `${API_URL}/pabbly/reviews`
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          data.error ||
            "Unable to fetch reviews."
        );
      }

      const loadedReviews =
        data.reviews || [];

      setReviews(loadedReviews);
      setPabblyConnected(true);

      const initialStatuses: Record<string, string> = {};

      for (const review of loadedReviews) {
        if (review.has_reply) {
          initialStatuses[review.id] =
            "posted";
        }
      }

      setStatuses(initialStatuses);
    } catch (error) {
      setReviews([]);
      setPabblyConnected(false);

      setGoogleError(
        getErrorMessage(
          error,
          "Unable to fetch reviews."
        )
      );
    } finally {
      setLoadingReviews(false);
    }
  }

  async function generateReply(
    review: Review
  ) {
    setErrors((old) => ({
      ...old,
      [review.id]: "",
    }));

    setStatuses((old) => ({
      ...old,
      [review.id]: "generating",
    }));

    try {
      const response = await fetch(
        `${API_URL}/generate-reply`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            review: review.review,
            rating: review.rating,
            reviewer: review.reviewer,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          data.error ||
            "Reply generation failed"
        );
      }

      if (!data.reply) {
        throw new Error(
          "AI returned an empty reply"
        );
      }

      setReplies((old) => ({
        ...old,
        [review.id]: data.reply,
      }));

      setStatuses((old) => ({
        ...old,
        [review.id]: "draft",
      }));
    } catch (error) {
      setStatuses((old) => ({
        ...old,
        [review.id]: "error",
      }));

      setErrors((old) => ({
        ...old,
        [review.id]:
          getErrorMessage(
            error,
            "Reply generation failed."
          ),
      }));
    }
  }

  async function generateReviews(
    targetReviews: Review[]
  ) {
    if (!targetReviews.length) {
      return;
    }

    setGeneratingAll(true);

    setGenerationProgress({
      current: 0,
      total: targetReviews.length,
    });

    for (
      let i = 0;
      i < targetReviews.length;
      i++
    ) {
      setGenerationProgress({
        current: i + 1,
        total: targetReviews.length,
      });

      await generateReply(
        targetReviews[i]
      );
    }

    setGeneratingAll(false);
  }

  // Reviews that don't have a drafted or posted reply yet
  // (a failed generation counts as still-pending so it's
  // picked up again by the next batch).
  const pendingReviews = reviews.filter((review) => {
    const status = statuses[review.id];
    return !status || status === "error";
  });

  async function generateNextBatch() {
    await generateReviews(
      pendingReviews.slice(0, BATCH_SIZE)
    );
  }

  async function postAllReplies() {
    if (!googleConnected && !pabblyConnected) {
      setGoogleError(
        "Fetch reviews (or connect Google Business Profile) before posting replies."
      );

      return;
    }

    if (
      googleConnected &&
      (!googleAccountId || !googleLocationId)
    ) {
      setGoogleError(
        "Connect Google Business Profile before posting replies."
      );

      return;
    }

    const draftReviews =
      reviews.filter(
        (review) =>
          statuses[review.id] ===
          "draft"
      );

    if (!draftReviews.length) {
      return;
    }

    const confirmed =
      window.confirm(
        `Post ${draftReviews.length} repl${
          draftReviews.length === 1
            ? "y"
            : "ies"
        } to Google Business Profile?\n\nThis action will publish them publicly.`
      );

    if (!confirmed) {
      return;
    }

    setPosting(true);
    setGoogleError("");

    for (const review of draftReviews) {
      try {
        const endpoint = googleConnected
          ? `${API_URL}/post-reply`
          : `${API_URL}/pabbly/post-reply`;

        const body = googleConnected
          ? {
              account_id:
                googleAccountId,
              location_id:
                googleLocationId,
              review_id:
                review.id,
              reply:
                replies[
                  review.id
                ],
            }
          : {
              review_id:
                review.id,
              reply:
                replies[
                  review.id
                ],
            };

        const response =
          await fetch(
            endpoint,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify(body),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          data.error
        ) {
          const detail =
            data.details?.error
              ?.message ||
            data.details?.message ||
            data.error ||
            "Posting failed";

          throw new Error(
            detail
          );
        }

        setStatuses((old) => ({
          ...old,
          [review.id]:
            "posted",
        }));

        setErrors((old) => ({
          ...old,
          [review.id]: "",
        }));
      } catch (error) {
        setStatuses((old) => ({
          ...old,
          [review.id]:
            "error",
        }));

        setErrors((old) => ({
          ...old,
          [review.id]:
            getErrorMessage(
              error,
              "Posting failed."
            ),
        }));
      }
    }

    setPosting(false);
  }

  function skipReply(
    reviewId: string
  ) {
    setStatuses((old) => ({
      ...old,
      [reviewId]: "skipped",
    }));

    setErrors((old) => ({
      ...old,
      [reviewId]: "",
    }));
  }

  const draftedCount =
    Object.values(statuses).filter(
      (status) =>
        status === "draft"
    ).length;

  const postedCount =
    Object.values(statuses).filter(
      (status) =>
        status === "posted"
    ).length;

  const unansweredCount =
    reviews.filter(
      (review) =>
        statuses[review.id] !==
        "posted"
    ).length;

  const attentionCount =
    reviews.filter(
      (review) =>
        review.rating <= 2 &&
        statuses[review.id] !==
          "posted"
    ).length;

  const visibleReviews =
    reviews.filter(
      (review) => {
        const status =
          statuses[
            review.id
          ];

        const statusMatches =
          filter === "all"
            ? true
            : filter ===
              "unanswered"
            ? status !== "posted"
            : filter ===
              "attention"
            ? review.rating <=
                2 &&
              status !== "posted"
            : status === filter;

        const ratingMatches =
          ratingFilter === "all"
            ? true
            : review.rating ===
              ratingFilter;

        return (
          statusMatches &&
          ratingMatches
        );
      }
    );

  const hasFetched =
    googleConnected || pabblyConnected;

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
            Fetch your reviews, generate
            replies, edit anything that
            needs it, and publish everything
            in one click.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <button
            onClick={
              loadPabblyReviews
            }
            disabled={loadingReviews}
            className={
              pabblyConnected
                ? "border border-green-700 bg-green-50 px-6 py-3 text-sm font-medium text-green-800"
                : "bg-[#171a20] px-6 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-black/20"
            }
          >
            {loadingReviews
              ? "Fetching..."
              : pabblyConnected
              ? "✓ Reviews fetched -- Refresh"
              : "Fetch Reviews"}
          </button>

          <button
            onClick={() => {
              window.location.href =
                `${API_URL}/auth/google`;
            }}
            className={
              googleConnected
                ? "border border-green-700 bg-green-50 px-6 py-3 text-sm font-medium text-green-800"
                : "border border-black/20 px-6 py-3 text-sm font-medium transition hover:bg-[#171a20] hover:text-white"
            }
          >
            {googleConnected
              ? "✓ Google Business Profile Connected"
              : "Connect Google Business Profile directly"}
          </button>

          {googleConnected && (
            <button
              onClick={
                loadGoogleReviews
              }
              className="border border-black/20 px-6 py-3 text-sm font-medium transition hover:bg-[#171a20] hover:text-white"
            >
              Refresh
            </button>
          )}

          <button
            onClick={
              loadDemoReviews
            }
            className="px-2 py-3 text-sm text-black/35 underline-offset-2 hover:underline"
          >
            Preview with sample data
          </button>
        </div>

        {googleError && (
          <div className="mt-5 max-w-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {googleError}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={
              generateNextBatch
            }
            disabled={
              generatingAll ||
              pendingReviews.length === 0
            }
            className="bg-[#171a20] px-6 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-black/20"
          >
            {generatingAll
              ? `Generating ${generationProgress.current}/${generationProgress.total}`
              : `Generate Reviews${
                  pendingReviews.length
                    ? ` (${Math.min(
                        pendingReviews.length,
                        BATCH_SIZE
                      )})`
                    : ""
                }`}
          </button>

          <button
            onClick={
              postAllReplies
            }
            disabled={
              posting ||
              draftedCount === 0 ||
              !hasFetched
            }
            className="border border-black/20 px-6 py-3 text-sm font-medium disabled:opacity-30"
          >
            {posting
              ? "Posting..."
              : `Post All Replies${
                  draftedCount
                    ? ` (${draftedCount})`
                    : ""
                }`}
          </button>
        </div>

        {pendingReviews.length > BATCH_SIZE && (
          <p className="mt-3 text-xs text-black/35">
            {pendingReviews.length} reviews still
            need replies -- click Generate Reviews
            again after this batch finishes.
          </p>
        )}
      </section>

      <section className="border-y border-black/10 bg-[#f5f5f5]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 md:grid-cols-4">
          <Stat
            label="Reviews"
            value={reviews.length}
          />
          <Stat
            label="Pending"
            value={pendingReviews.length}
          />
          <Stat
            label="Drafts"
            value={draftedCount}
          />
          <Stat
            label="Posted"
            value={postedCount}
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 md:px-10">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-black/35">
            Inbox
          </p>

          <h2 className="mt-3 text-3xl font-medium">
            Reviews
          </h2>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <FilterButton
            label={`All (${reviews.length})`}
            active={filter === "all"}
            onClick={() =>
              setFilter("all")
            }
          />

          <FilterButton
            label={`Unanswered (${unansweredCount})`}
            active={
              filter ===
              "unanswered"
            }
            onClick={() =>
              setFilter(
                "unanswered"
              )
            }
          />

          <FilterButton
            label={`Needs attention (${attentionCount})`}
            active={
              filter ===
              "attention"
            }
            onClick={() =>
              setFilter(
                "attention"
              )
            }
          />

          <FilterButton
            label={`Drafts (${draftedCount})`}
            active={
              filter === "draft"
            }
            onClick={() =>
              setFilter("draft")
            }
          />

          <FilterButton
            label={`Posted (${postedCount})`}
            active={
              filter === "posted"
            }
            onClick={() =>
              setFilter(
                "posted"
              )
            }
          />
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          {(
            [
              "all",
              5,
              4,
              3,
              2,
              1,
            ] as RatingFilter[]
          ).map((rating) => (
            <FilterButton
              key={rating}
              label={
                rating === "all"
                  ? "All ratings"
                  : `${rating}★`
              }
              active={
                ratingFilter ===
                rating
              }
              onClick={() =>
                setRatingFilter(
                  rating
                )
              }
            />
          ))}
        </div>

        {loadingReviews ? (
          <div className="border-t border-black/10 py-20 text-sm text-black/40">
            Loading reviews...
          </div>
        ) : visibleReviews.length ===
          0 ? (
          <div className="border-t border-black/10 py-20 text-sm text-black/40">
            {reviews.length === 0
              ? "No reviews loaded yet -- click \u201cFetch Reviews\u201d above."
              : "No reviews found."}
          </div>
        ) : (
          <div className="border-t border-black/10">
            {visibleReviews.map(
              (review, index) => {
                const status =
                  statuses[
                    review.id
                  ];

                return (
                  <article
                    key={review.id}
                    className="grid gap-8 border-b border-black/10 py-10 md:grid-cols-[210px_1fr]"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {
                          review.reviewer
                        }
                      </p>

                      <p className="mt-2 text-xs text-black/35">
                        Review{" "}
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </p>

                      <div className="mt-5 text-sm">
                        {"★".repeat(
                          review.rating
                        )}
                        <span className="text-black/15">
                          {"★".repeat(
                            5 -
                              review.rating
                          )}
                        </span>
                      </div>

                      {review.rating <=
                        2 &&
                        status !==
                          "posted" && (
                          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-red-600">
                            Needs attention
                          </p>
                        )}

                      <div className="mt-4">
                        <StatusBadge
                          status={
                            status
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <p className="max-w-3xl text-xl leading-8 md:text-2xl">
                        {review.review
                          ? `\u201c${review.review}\u201d`
                          : "No written comment"}
                      </p>

                      {review.existing_reply &&
                        status ===
                          "posted" && (
                          <div className="mt-7 border-l-2 border-black/15 pl-5">
                            <p className="text-xs uppercase text-black/35">
                              Existing Google
                              reply
                            </p>

                            <p className="mt-3 text-base leading-7 text-black/60">
                              {
                                review.existing_reply
                              }
                            </p>
                          </div>
                        )}

                      {!replies[
                        review.id
                      ] &&
                        status !==
                          "posted" && (
                          <button
                            onClick={() =>
                              generateReply(
                                review
                              )
                            }
                            disabled={
                              status ===
                              "generating"
                            }
                            className="mt-7 border-b border-black pb-1 text-sm font-medium disabled:opacity-30"
                          >
                            {status ===
                            "generating"
                              ? "Generating..."
                              : "Generate reply"}
                          </button>
                        )}

                      {replies[
                        review.id
                      ] && (
                        <div className="mt-8">
                          <p className="mb-3 text-xs uppercase text-black/35">
                            Suggested reply
                          </p>

                          <textarea
                            value={
                              replies[
                                review.id
                              ]
                            }
                            onChange={(e) => {
                              setReplies(
                                (old) => ({
                                  ...old,
                                  [review.id]:
                                    e
                                      .target
                                      .value,
                                })
                              );
                            }}
                            disabled={
                              status ===
                              "posted"
                            }
                            className="min-h-36 w-full resize-y border border-black/15 p-5"
                          />

                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              onClick={() =>
                                skipReply(
                                  review.id
                                )
                              }
                              disabled={
                                status ===
                                "posted"
                              }
                              className="border border-black/15 px-5 py-2.5 text-sm disabled:opacity-30"
                            >
                              Skip
                            </button>

                            <button
                              onClick={() =>
                                generateReply(
                                  review
                                )
                              }
                              disabled={
                                status ===
                                  "posted" ||
                                status ===
                                  "generating"
                              }
                              className="px-2 py-2.5 text-sm text-black/40 disabled:opacity-30"
                            >
                              Regenerate
                            </button>
                          </div>
                        </div>
                      )}

                      {errors[
                        review.id
                      ] && (
                        <p className="mt-4 text-sm text-red-600">
                          {
                            errors[
                              review.id
                            ]
                          }
                        </p>
                      )}
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>
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
    <div className="border-r border-black/10 px-6 py-7">
      <div className="text-3xl font-medium">
        {value}
      </div>

      <div className="mt-1 text-xs uppercase text-black/35">
        {label}
      </div>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "bg-[#171a20] px-4 py-2 text-sm text-white"
          : "border border-black/15 px-4 py-2 text-sm text-black/55"
      }
    >
      {label}
    </button>
  );
}

function StatusBadge({
  status,
}: {
  status?: string;
}) {
  if (
    !status ||
    status === "error"
  ) {
    return null;
  }

  const labels: Record<
    string,
    string
  > = {
    draft: "Draft",
    skipped: "Skipped",
    posted: "Posted",
    generating:
      "Generating",
  };

  return (
    <span className="text-xs uppercase text-black/40">
      {labels[status] ||
        status}
    </span>
  );
}
