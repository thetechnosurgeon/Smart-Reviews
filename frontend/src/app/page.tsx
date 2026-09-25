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
  | "approved"
  | "posted";

type RatingFilter =
  | "all"
  | 1
  | 2
  | 3
  | 4
  | 5;

const BATCH_SIZE = 25;

// This account has more than one Google Business Profile location on it.
// Reviews only live under this one -- if it's ever missing from the
// account's location list, we fall back to the first one returned.
const PRIMARY_LOCATION_ID = "9505403968657639010";

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

  const [filter, setFilter] =
    useState<Filter>("all");

  const [ratingFilter, setRatingFilter] =
    useState<RatingFilter>("all");

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    if (params.get("connected") === "true") {
      setGoogleConnected(true);
      loadGoogleReviews();
    }
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

      const matchedLocation =
        locationData.locations.find(
          (loc: { name: string }) =>
            loc.name?.replace(
              "locations/",
              ""
            ) === PRIMARY_LOCATION_ID
        ) || locationData.locations[0];

      const locationId =
        matchedLocation.name.replace(
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
      setGoogleConnected(true);

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
      setGoogleConnected(false);

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

  // Reviews with no reply yet (a failed generation counts as
  // still-pending so the next batch picks it up again).
  const pendingReviews = reviews.filter((review) => {
    const status = statuses[review.id];
    return !status || status === "error";
  });

  async function generateNextBatch() {
    await generateReviews(
      pendingReviews.slice(0, BATCH_SIZE)
    );
  }

  async function approveReply(
    review: Review
  ) {
    const replyText = (
      replies[review.id] || ""
    ).trim();

    if (!replyText) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/approve-reply`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            review_id: review.id,
            reply: replyText,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          data.error ||
            "Could not approve this reply."
        );
      }

      setStatuses((old) => ({
        ...old,
        [review.id]: "approved",
      }));

      setErrors((old) => ({
        ...old,
        [review.id]: "",
      }));
    } catch (error) {
      setErrors((old) => ({
        ...old,
        [review.id]:
          getErrorMessage(
            error,
            "Could not approve this reply."
          ),
      }));
    }
  }

  function editReply(
    reviewId: string,
    value: string
  ) {
    setReplies((old) => ({
      ...old,
      [reviewId]: value,
    }));

    // Editing an already-approved reply means the approval no
    // longer covers the current text -- it needs a fresh approve.
    setStatuses((old) =>
      old[reviewId] === "approved"
        ? { ...old, [reviewId]: "draft" }
        : old
    );
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

  async function postApprovedReplies() {
    if (
      !googleConnected ||
      !googleAccountId ||
      !googleLocationId
    ) {
      setGoogleError(
        "Connect Google Business Profile before posting replies."
      );

      return;
    }

    const approvedReviews =
      reviews.filter(
        (review) =>
          statuses[review.id] ===
          "approved"
      );

    if (!approvedReviews.length) {
      return;
    }

    const confirmed =
      window.confirm(
        `Post ${approvedReviews.length} approved repl${
          approvedReviews.length === 1
            ? "y"
            : "ies"
        } to Google Business Profile?\n\nThis action will publish them publicly.`
      );

    if (!confirmed) {
      return;
    }

    setPosting(true);
    setGoogleError("");

    for (const review of approvedReviews) {
      try {
        const response = await fetch(
          `${API_URL}/post-reply`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              account_id:
                googleAccountId,
              location_id:
                googleLocationId,
              review_id: review.id,
              reply:
                replies[review.id],
            }),
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
          [review.id]: "posted",
        }));

        setErrors((old) => ({
          ...old,
          [review.id]: "",
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
              "Posting failed."
            ),
        }));
      }
    }

    setPosting(false);
  }

  const draftedCount =
    Object.values(statuses).filter(
      (status) => status === "draft"
    ).length;

  const approvedCount =
    Object.values(statuses).filter(
      (status) => status === "approved"
    ).length;

  const postedCount =
    Object.values(statuses).filter(
      (status) => status === "posted"
    ).length;

  const unansweredCount =
    reviews.filter(
      (review) =>
        statuses[review.id] !== "posted"
    ).length;

  const attentionCount =
    reviews.filter(
      (review) =>
        review.rating <= 2 &&
        statuses[review.id] !== "posted"
    ).length;

  const visibleReviews =
    reviews.filter((review) => {
      const status =
        statuses[review.id];

      const statusMatches =
        filter === "all"
          ? true
          : filter === "unanswered"
          ? status !== "posted"
          : filter === "attention"
          ? review.rating <= 2 &&
            status !== "posted"
          : status === filter;

      const ratingMatches =
        ratingFilter === "all"
          ? true
          : review.rating ===
            ratingFilter;

      return (
        statusMatches && ratingMatches
      );
    });

  return (
    <main className="min-h-screen bg-[#FAFAF8] text-[#0B0C10]">
      <section className="relative overflow-hidden bg-[#0B0C10] text-[#FAFAF8]">
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-16 md:px-10 md:pb-28 md:pt-20">
          <h1 className="text-[15vw] font-[900] leading-[0.86] tracking-[-0.05em] sm:text-[96px] md:text-[124px]">
            SMART
            <br />
            REVIEWS
          </h1>

          <p className="mt-5 text-sm text-white/45">
            Built by Dr. Abhinav Rao and Agents
          </p>

          <p className="mt-10 max-w-xl text-lg leading-8 text-white/70 md:text-xl">
            Connect your Google Business Profile,
            generate replies in batches, approve
            what&apos;s right, and publish everything
            in one click.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              onClick={() => {
                window.location.href =
                  `${API_URL}/auth/google`;
              }}
              disabled={
                loadingReviews
              }
              className="bg-[#3552FF] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[#2A42D6] disabled:cursor-not-allowed disabled:bg-white/20"
            >
              {loadingReviews
                ? "Connecting..."
                : googleConnected
                ? "Reconnect Google Business Profile"
                : "Connect Google Business Profile"}
            </button>

            {googleConnected && (
              <button
                onClick={
                  loadGoogleReviews
                }
                disabled={
                  loadingReviews
                }
                className="border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition hover:border-white/50"
              >
                Refresh reviews
              </button>
            )}
          </div>

          {googleError && (
            <div className="mt-6 max-w-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">
              {googleError}
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-black/10 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 md:grid-cols-5">
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
            label="Approved"
            value={approvedCount}
          />
          <Stat
            label="Posted"
            value={postedCount}
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pt-10 md:px-10">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={
              generateNextBatch
            }
            disabled={
              generatingAll ||
              pendingReviews.length === 0
            }
            className="bg-[#0B0C10] px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/20"
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
              postApprovedReplies
            }
            disabled={
              posting ||
              approvedCount === 0 ||
              !googleConnected
            }
            className="border border-[#0B0C10]/20 px-6 py-3 text-sm font-semibold disabled:opacity-30"
          >
            {posting
              ? "Posting..."
              : `Post Approved${
                  approvedCount
                    ? ` (${approvedCount})`
                    : ""
                }`}
          </button>
        </div>

        {pendingReviews.length > BATCH_SIZE && (
          <p className="mt-3 text-sm text-[#63666D]">
            {pendingReviews.length} reviews still
            need replies -- click Generate Reviews
            again after this batch finishes.
          </p>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 md:px-10">
        <h2 className="mb-8 text-3xl font-bold tracking-[-0.02em]">
          Reviews
        </h2>

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
              filter === "unanswered"
            }
            onClick={() =>
              setFilter("unanswered")
            }
          />

          <FilterButton
            label={`Needs attention (${attentionCount})`}
            active={
              filter === "attention"
            }
            onClick={() =>
              setFilter("attention")
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
            label={`Approved (${approvedCount})`}
            active={
              filter === "approved"
            }
            onClick={() =>
              setFilter("approved")
            }
          />

          <FilterButton
            label={`Posted (${postedCount})`}
            active={
              filter === "posted"
            }
            onClick={() =>
              setFilter("posted")
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
          <div className="border-t border-black/10 py-20 text-sm text-[#63666D]">
            Loading reviews...
          </div>
        ) : visibleReviews.length ===
          0 ? (
          <div className="border-t border-black/10 py-20 text-sm text-[#63666D]">
            {reviews.length === 0
              ? "No reviews loaded yet -- connect your Google Business Profile above."
              : "No reviews found."}
          </div>
        ) : (
          <div className="border-t border-black/10">
            {visibleReviews.map(
              (review) => {
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
                      <p className="text-sm font-semibold">
                        {
                          review.reviewer
                        }
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
                          <p className="mt-3 text-xs font-semibold text-red-600">
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
                            <p className="text-xs text-[#63666D]">
                              Existing reply
                              from Google
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
                            className="mt-7 border-b-2 border-[#3552FF] pb-1 text-sm font-semibold text-[#3552FF] disabled:opacity-30"
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
                          <p className="mb-3 text-sm text-[#63666D]">
                            Suggested reply
                          </p>

                          <textarea
                            value={
                              replies[
                                review.id
                              ]
                            }
                            onChange={(e) =>
                              editReply(
                                review.id,
                                e.target
                                  .value
                              )
                            }
                            disabled={
                              status ===
                              "posted"
                            }
                            className="min-h-36 w-full resize-y border border-black/15 p-5 focus:border-[#3552FF] focus:outline-none"
                          />

                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              onClick={() =>
                                approveReply(
                                  review
                                )
                              }
                              disabled={
                                status ===
                                  "posted" ||
                                status ===
                                  "approved"
                              }
                              className="bg-[#0B0C10] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/20"
                            >
                              {status ===
                              "approved"
                                ? "Approved"
                                : "Approve"}
                            </button>

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
                              className="px-2 py-2.5 text-sm text-[#63666D] disabled:opacity-30"
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
      <div className="text-3xl font-bold">
        {value}
      </div>

      <div className="mt-1 text-sm text-[#63666D]">
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
          ? "bg-[#0B0C10] px-4 py-2 text-sm font-medium text-white"
          : "border border-black/15 px-4 py-2 text-sm text-[#63666D]"
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

  const labels: Record<string, string> = {
    draft: "Draft",
    approved: "Approved",
    skipped: "Skipped",
    posted: "Posted",
    generating: "Generating",
  };

  return (
    <span className="text-sm text-[#63666D]">
      {labels[status] || status}
    </span>
  );
}
