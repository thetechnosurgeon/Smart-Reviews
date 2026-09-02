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
  | "draft"
  | "approved"
  | "posted";

export default function Home() {
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    "https://smart-reviews.onrender.com";

  const [reviews, setReviews] = useState<Review[]>([]);
  const [replies, setReplies] = useState<{
    [key: string]: string;
  }>({});

  const [statuses, setStatuses] = useState<{
    [key: string]: string;
  }>({});

  const [errors, setErrors] = useState<{
    [key: string]: string;
  }>({});

  const [loadingReviews, setLoadingReviews] =
    useState(true);

  const [generatingAll, setGeneratingAll] =
    useState(false);

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

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const connected =
      params.get("connected") === "true";

    if (connected) {
      setGoogleConnected(true);
      loadGoogleReviews();
    } else {
      loadDemoReviews();
    }
  }, []);

  async function readJson(response: Response) {
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
          data?.error ||
          data?.detail ||
          "Request failed"
      );
    }

    return data;
  }

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

  async function loadDemoReviews() {
    setLoadingReviews(true);
    setGoogleError("");

    try {
      const response = await fetch(
        `${API_URL}/reviews`
      );

      const data = await readJson(response);

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

    try {
      const accountResponse = await fetch(
        `${API_URL}/google/accounts`
      );

      const accountData =
        await accountResponse.json();

      if (accountData.error) {
        const detail =
          accountData.error?.message ||
          accountData.error?.error?.message ||
          JSON.stringify(
            accountData.error
          );

        throw new Error(detail);
      }

      if (!accountData.accounts?.length) {
        throw new Error(
          "No Google Business Profile accounts found."
        );
      }

      const accountName =
        accountData.accounts[0].name;

      const accountId =
        accountName.replace(
          "accounts/",
          ""
        );

      setGoogleAccountId(
        accountId
      );

      const locationResponse = await fetch(
        `${API_URL}/google/locations/${accountId}`
      );

      const locationData =
        await locationResponse.json();

      if (locationData.error) {
        const detail =
          locationData.error?.message ||
          locationData.error?.error?.message ||
          JSON.stringify(
            locationData.error
          );

        throw new Error(detail);
      }

      if (!locationData.locations?.length) {
        throw new Error(
          "No Google Business Profile locations found."
        );
      }

      const locationName =
        locationData.locations[0].name;

      const locationId =
        locationName.replace(
          "locations/",
          ""
        );

      setGoogleLocationId(
        locationId
      );

      const reviewResponse = await fetch(
        `${API_URL}/reviews/${accountId}/${locationId}`
      );

      const reviewData =
        await reviewResponse.json();

      if (reviewData.error) {
        const detail =
          reviewData.error?.message ||
          reviewData.error?.error?.message ||
          JSON.stringify(
            reviewData.error
          );

        throw new Error(detail);
      }

      setReviews(
        reviewData.reviews || []
      );

      const initialStatuses: {
        [key: string]: string;
      } = {};

      for (
        const review of
        reviewData.reviews || []
      ) {
        if (review.has_reply) {
          initialStatuses[
            review.id
          ] = "posted";
        }
      }

      setStatuses(
        initialStatuses
      );
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

  async function generateReply(
    reviewId: string,
    reviewText: string,
    rating: number,
    reviewer: string
  ) {
    setErrors((old) => ({
      ...old,
      [reviewId]: "",
    }));

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
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            review: reviewText,
            rating,
            reviewer,
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
        [reviewId]:
          data.reply,
      }));

      setStatuses((old) => ({
        ...old,
        [reviewId]: "draft",
      }));
    } catch (error) {
      setStatuses((old) => ({
        ...old,
        [reviewId]: "error",
      }));

      setErrors((old) => ({
        ...old,
        [reviewId]:
          getErrorMessage(
            error,
            "Reply generation failed."
          ),
      }));
    }
  }

  async function generateAllReplies() {
    setGeneratingAll(true);

    for (const review of reviews) {
      if (
        statuses[review.id] ===
        "posted"
      ) {
        continue;
      }

      await generateReply(
        review.id,
        review.review,
        review.rating,
        review.reviewer
      );
    }

    setGeneratingAll(false);
  }

  async function approveReply(
    reviewId: string
  ) {
    if (
      !replies[reviewId]?.trim()
    ) {
      setErrors((old) => ({
        ...old,
        [reviewId]:
          "Reply cannot be empty.",
      }));

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
            review_id:
              reviewId,
            reply:
              replies[reviewId],
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          data.error ||
            "Approval failed"
        );
      }

      setStatuses((old) => ({
        ...old,
        [reviewId]:
          "approved",
      }));

      setErrors((old) => ({
        ...old,
        [reviewId]: "",
      }));
    } catch (error) {
      setStatuses((old) => ({
        ...old,
        [reviewId]: "error",
      }));

      setErrors((old) => ({
        ...old,
        [reviewId]:
          getErrorMessage(
            error,
            "Approval failed."
          ),
      }));
    }
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

    setPosting(true);
    setGoogleError("");

    for (const review of reviews) {
      if (
        statuses[review.id] !==
        "approved"
      ) {
        continue;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/post-reply`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
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
            data.details
              ?.message ||
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
    Object.values(
      statuses
    ).filter(
      (status) =>
        status === "draft"
    ).length;

  const approvedCount =
    Object.values(
      statuses
    ).filter(
      (status) =>
        status === "approved"
    ).length;

  const postedCount =
    Object.values(
      statuses
    ).filter(
      (status) =>
        status === "posted"
    ).length;

  const unansweredCount =
    reviews.filter(
      (review) =>
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

        if (
          filter === "all"
        ) {
          return true;
        }

        if (
          filter ===
          "unanswered"
        ) {
          return (
            status !==
            "posted"
          );
        }

        return (
          status === filter
        );
      }
    );

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
            Generate thoughtful replies,
            refine them, approve what
            matters, and publish only
            when you are ready.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
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
              : "Connect Google Business Profile"}
          </button>

          {googleConnected && (
            <button
              onClick={
                loadGoogleReviews
              }
              className="border border-black/20 px-6 py-3 text-sm font-medium transition hover:bg-[#171a20] hover:text-white"
            >
              Refresh reviews
            </button>
          )}
        </div>

        {googleError && (
          <div className="mt-5 max-w-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {googleError}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={
              generateAllReplies
            }
            disabled={
              generatingAll ||
              reviews.length === 0
            }
            className="bg-[#171a20] px-6 py-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/20"
          >
            {generatingAll
              ? "Generating..."
              : "Generate all replies"}
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
            className="border border-black/20 px-6 py-3 text-sm font-medium transition hover:border-black hover:bg-[#171a20] hover:text-white disabled:cursor-not-allowed disabled:border-black/10 disabled:text-black/25"
          >
            {posting
              ? "Posting..."
              : approvedCount >
                0
              ? `Post approved (${approvedCount})`
              : "Post approved"}
          </button>
        </div>
      </section>

      <section className="border-y border-black/10 bg-[#f5f5f5]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 md:grid-cols-4">
          <Stat
            label="Reviews"
            value={
              reviews.length
            }
          />

          <Stat
            label="Drafts"
            value={
              draftedCount
            }
          />

          <Stat
            label="Approved"
            value={
              approvedCount
            }
          />

          <Stat
            label="Posted"
            value={
              postedCount
            }
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-black/35">
            Inbox
          </p>

          <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em]">
            Reviews
          </h2>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          <FilterButton
            label={`All (${reviews.length})`}
            active={
              filter === "all"
            }
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
            label={`Drafts (${draftedCount})`}
            active={
              filter ===
              "draft"
            }
            onClick={() =>
              setFilter("draft")
            }
          />

          <FilterButton
            label={`Approved (${approvedCount})`}
            active={
              filter ===
              "approved"
            }
            onClick={() =>
              setFilter(
                "approved"
              )
            }
          />

          <FilterButton
            label={`Posted (${postedCount})`}
            active={
              filter ===
              "posted"
            }
            onClick={() =>
              setFilter(
                "posted"
              )
            }
          />
        </div>

        {loadingReviews ? (
          <div className="border-t border-black/10 py-20 text-sm text-black/40">
            Loading reviews...
          </div>
        ) : visibleReviews.length ===
          0 ? (
          <div className="border-t border-black/10 py-20">
            <p className="text-lg font-medium">
              No reviews found.
            </p>
          </div>
        ) : (
          <div className="border-t border-black/10">
            {visibleReviews.map(
              (
                review,
                index
              ) => {
                const status =
                  statuses[
                    review.id
                  ];

                const existingReply =
                  review.existing_reply;

                return (
                  <article
                    key={
                      review.id
                    }
                    className="grid gap-8 border-b border-black/10 py-10 md:grid-cols-[180px_1fr] md:py-12"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {
                          review.reviewer
                        }
                      </p>

                      <p className="mt-2 text-xs uppercase tracking-[0.14em] text-black/35">
                        Review{" "}
                        {String(
                          index +
                            1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </p>

                      <div className="mt-5 text-sm tracking-[0.08em]">
                        {"★".repeat(
                          Number(
                            review.rating
                          )
                        )}

                        <span className="text-black/15">
                          {"★".repeat(
                            Math.max(
                              0,
                              5 -
                                Number(
                                  review.rating
                                )
                            )
                          )}
                        </span>
                      </div>

                      {status && (
                        <div className="mt-5">
                          <StatusBadge
                            status={
                              status
                            }
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="max-w-3xl text-xl leading-8 tracking-[-0.01em] md:text-2xl md:leading-9">
                        {review.review
                          ? `“${review.review}”`
                          : "No written comment"}
                      </p>

                      {existingReply &&
                        status ===
                          "posted" && (
                          <div className="mt-7 border-l-2 border-black/15 pl-5">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-black/35">
                              Existing
                              Google reply
                            </p>

                            <p className="mt-3 max-w-3xl text-base leading-7 text-black/60">
                              {
                                existingReply
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
                                review.id,
                                review.review,
                                review.rating,
                                review.reviewer
                              )
                            }
                            disabled={
                              status ===
                              "generating"
                            }
                            className="mt-7 border-b border-black pb-1 text-sm font-medium transition hover:opacity-50 disabled:opacity-30"
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
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-black/35">
                              Suggested
                              reply
                            </p>

                            <StatusBadge
                              status={
                                status
                              }
                            />
                          </div>

                          <textarea
                            value={
                              replies[
                                review.id
                              ]
                            }
                            onChange={(
                              e
                            ) => {
                              setReplies(
                                (
                                  old
                                ) => ({
                                  ...old,
                                  [review.id]:
                                    e
                                      .target
                                      .value,
                                })
                              );

                              if (
                                status ===
                                "approved"
                              ) {
                                setStatuses(
                                  (
                                    old
                                  ) => ({
                                    ...old,
                                    [review.id]:
                                      "draft",
                                  })
                                );
                              }
                            }}
                            disabled={
                              status ===
                              "posted"
                            }
                            className="min-h-36 w-full resize-y border border-black/15 bg-white p-5 text-base leading-7 outline-none transition focus:border-black disabled:bg-black/5 disabled:text-black/40"
                          />

                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              onClick={() =>
                                approveReply(
                                  review.id
                                )
                              }
                              disabled={
                                status ===
                                "posted"
                              }
                              className="bg-[#171a20] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/20"
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
                              className="border border-black/15 px-5 py-2.5 text-sm font-medium transition hover:border-black disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              Skip
                            </button>

                            <button
                              onClick={() =>
                                generateReply(
                                  review.id,
                                  review.review,
                                  review.rating,
                                  review.reviewer
                                )
                              }
                              disabled={
                                status ===
                                  "posted" ||
                                status ===
                                  "generating"
                              }
                              className="px-2 py-2.5 text-sm font-medium text-black/40 transition hover:text-black disabled:cursor-not-allowed disabled:opacity-25"
                            >
                              {status ===
                              "generating"
                                ? "Generating..."
                                : "Regenerate"}
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

      <footer className="border-t border-black/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 text-xs text-black/35 md:flex-row md:items-center md:justify-between md:px-10">
          <span>
            Smart Reviews
          </span>

          <span>
            AI drafts. Human
            decisions.
          </span>
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
          ? "bg-[#171a20] px-4 py-2 text-sm font-medium text-white"
          : "border border-black/15 px-4 py-2 text-sm font-medium text-black/55 transition hover:border-black hover:text-black"
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
  const labels: {
    [key: string]: string;
  } = {
    draft: "Draft",
    approved: "Approved",
    skipped: "Skipped",
    posted: "Posted",
    generating:
      "Generating",
  };

  if (
    !status ||
    status === "error"
  ) {
    return null;
  }

  return (
    <span className="text-xs font-medium uppercase tracking-[0.14em] text-black/40">
      {labels[status] ||
        status}
    </span>
  );
}