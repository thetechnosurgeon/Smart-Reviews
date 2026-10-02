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

type Location = {
  id: string;
  title: string;
  address: string;
  reviewLink: string;
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

type User = {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  connected: boolean;
  active_business: {
    google_account_id: string;
    location_id: string;
    title: string | null;
  } | null;
  consent_version: string;
  consented: boolean;
};

type Templates = {
  five_star: string;
  middle: string;
  one_star: string;
};

const BATCH_SIZE = 25;

const AUTH_ERRORS: Record<string, string> = {
  denied: "Sign-in was cancelled. Click Connect to try again.",
  missing_business_scope:
    "Smart Repute needs access to your Business Profile. Please try again and leave every permission ticked.",
  state_mismatch:
    "The sign-in session expired. Please try again.",
  no_refresh_token:
    "Google did not grant lasting access. Please try again.",
  token_exchange_failed:
    "Google rejected the sign-in. Please try again.",
  userinfo_failed:
    "We could not read your Google profile. Please try again.",
};

// Turns whatever the API sent back into a readable sentence.
function describeApiError(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  const e = error as {
    message?: string;
    error?: { message?: string };
  };

  return (
    e?.message ||
    e?.error?.message ||
    JSON.stringify(error)
  );
}

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

  const [user, setUser] =
    useState<User | null>(null);

  const [authChecked, setAuthChecked] =
    useState(false);

  const [locations, setLocations] =
    useState<Location[]>([]);

  const [showLocationPicker, setShowLocationPicker] =
    useState(false);

  const [filter, setFilter] =
    useState<Filter>("all");

  const [ratingFilter, setRatingFilter] =
    useState<RatingFilter>("all");

  const [acceptingConsent, setAcceptingConsent] =
    useState(false);

  const [showTemplatesPanel, setShowTemplatesPanel] =
    useState(false);

  const [templates, setTemplates] =
    useState<Templates>({
      five_star: "",
      middle: "",
      one_star: "",
    });

  const [templatesLoading, setTemplatesLoading] =
    useState(false);

  const [templatesSaving, setTemplatesSaving] =
    useState(false);

  const [templatesError, setTemplatesError] =
    useState("");

  const [showReviewLink, setShowReviewLink] =
    useState(false);

  const [savedExampleIds, setSavedExampleIds] =
    useState<Record<string, boolean>>({});

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const authError = params.get("auth_error");

    if (authError) {
      setGoogleError(
        AUTH_ERRORS[authError] ||
          "Sign-in failed. Please try again."
      );
    }

    if (authError || params.get("connected")) {
      window.history.replaceState(
        {},
        "",
        window.location.pathname
      );
    }

    checkSession();
  }, []);

  // Every call to the API carries the login cookie.
  async function apiFetch(
    path: string,
    init: RequestInit = {}
  ) {
    const response = await fetch(
      `${API_URL}${path}`,
      { ...init, credentials: "include" }
    );

    if (response.status === 401) {
      setUser(null);
      setGoogleConnected(false);
    }

    return response;
  }

  async function checkSession() {
    try {
      const response = await apiFetch("/me");

      if (response.ok) {
        const me: User = await response.json();

        setUser(me);

        if (me.connected) {
          await loadGoogleReviews({
            preferredLocationId:
              me.active_business?.location_id,
          });
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setAuthChecked(true);
    }
  }

  function clearSignedInState() {
    setUser(null);
    setGoogleConnected(false);
    setReviews([]);
    setLocations([]);
    setShowLocationPicker(false);
    setGoogleAccountId("");
    setGoogleLocationId("");
    resetWorkflow();
  }

  async function signOut() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      clearSignedInState();
      setGoogleError("");
    }
  }

  async function disconnectAccount() {
    const confirmed = window.confirm(
      "Disconnect Google Business Profile?\n\nSmart Repute's access to your profile is revoked and you are signed out. You can reconnect any time."
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await apiFetch(
        "/account/disconnect",
        { method: "POST" }
      );

      if (!response.ok) {
        const data = await response.json();

        throw new Error(describeApiError(data.error));
      }

      clearSignedInState();
      setGoogleError("");
    } catch (error) {
      setGoogleError(
        getErrorMessage(
          error,
          "Could not disconnect. Please try again."
        )
      );
    }
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

  function resetWorkflow() {
    setReplies({});
    setStatuses({});
    setErrors({});
  }

  async function acceptConsent() {
    setAcceptingConsent(true);

    try {
      const response = await apiFetch(
        "/consent/accept",
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error(
          "Could not save your acceptance. Please try again."
        );
      }

      setUser((old) =>
        old
          ? { ...old, consented: true }
          : old
      );
    } catch (error) {
      setGoogleError(
        getErrorMessage(
          error,
          "Could not save your acceptance. Please try again."
        )
      );
    } finally {
      setAcceptingConsent(false);
    }
  }

  async function loadTemplates() {
    setTemplatesLoading(true);
    setTemplatesError("");

    try {
      const response = await apiFetch(
        "/templates"
      );

      if (!response.ok) {
        throw new Error(
          "Could not load your templates."
        );
      }

      setTemplates(
        await response.json()
      );
    } catch (error) {
      setTemplatesError(
        getErrorMessage(
          error,
          "Could not load your templates."
        )
      );
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function openTemplatesPanel() {
    setShowTemplatesPanel(true);

    await loadTemplates();
  }

  async function saveTemplates() {
    setTemplatesSaving(true);
    setTemplatesError("");

    try {
      const response = await apiFetch(
        "/templates",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(templates),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          describeApiError(data.error)
        );
      }

      setTemplates(data);
      setShowTemplatesPanel(false);
    } catch (error) {
      setTemplatesError(
        getErrorMessage(
          error,
          "Could not save your templates."
        )
      );
    } finally {
      setTemplatesSaving(false);
    }
  }

  async function loadGoogleReviews(
    options: {
      preferredLocationId?: string;
      forcePicker?: boolean;
    } = {}
  ) {
    setLoadingReviews(true);
    setGoogleError("");
    resetWorkflow();

    try {
      const accountResponse = await apiFetch(
        "/google/accounts"
      );

      const accountData =
        await accountResponse.json();

      if (accountData.error) {
        throw new Error(
          describeApiError(accountData.error)
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

      const locationResponse = await apiFetch(
        `/google/locations/${accountId}`
      );

      const locationData =
        await locationResponse.json();

      if (locationData.error) {
        throw new Error(
          describeApiError(locationData.error)
        );
      }

      if (!locationData.locations?.length) {
        throw new Error(
          "No Google Business Profile locations found."
        );
      }

      const parsedLocations: Location[] =
        locationData.locations.map(
          (loc: {
            name: string;
            title?: string;
            storefrontAddress?: {
              addressLines?: string[];
              locality?: string;
            };
            metadata?: {
              newReviewUri?: string;
            };
          }) => ({
            id: loc.name.replace(
              "locations/",
              ""
            ),
            title:
              loc.title ||
              "Untitled location",
            address: [
              loc.storefrontAddress?.addressLines?.join(
                ", "
              ),
              loc.storefrontAddress
                ?.locality,
            ]
              .filter(Boolean)
              .join(", "),
            reviewLink:
              loc.metadata
                ?.newReviewUri || "",
          })
        );

      setLocations(parsedLocations);

      const remembered =
        !options.forcePicker &&
        options.preferredLocationId
          ? parsedLocations.find(
              (loc) =>
                loc.id ===
                options.preferredLocationId
            )
          : undefined;

      if (parsedLocations.length === 1) {
        await loadReviewsForLocation(
          accountId,
          parsedLocations[0].id
        );
      } else if (remembered) {
        await loadReviewsForLocation(
          accountId,
          remembered.id
        );
      } else {
        setShowLocationPicker(true);
        setLoadingReviews(false);
      }
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
      setLoadingReviews(false);
    }
  }

  async function chooseLocation(loc: Location) {
    // Remember the choice on the server so a refresh (or another
    // device) opens straight into this business.
    apiFetch("/account/active-business", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        google_account_id: googleAccountId,
        location_id: loc.id,
        title: loc.title,
      }),
    }).catch(() => {});

    await loadReviewsForLocation(
      googleAccountId,
      loc.id
    );
  }

  async function loadReviewsForLocation(
    accountId: string,
    locationId: string
  ) {
    setLoadingReviews(true);
    setShowLocationPicker(false);
    setGoogleLocationId(locationId);
    resetWorkflow();

    try {
      const reviewResponse = await apiFetch(
        `/reviews/${accountId}/${locationId}`
      );

      const reviewData =
        await reviewResponse.json();

      if (reviewData.error) {
        throw new Error(
          describeApiError(reviewData.error)
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
      const response = await apiFetch(
        "/generate-reply",
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
      const response = await apiFetch(
        "/approve-reply",
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

  async function saveAsExample(
    rating: number,
    reviewText: string,
    replyText: string,
    key: string
  ) {
    try {
      const response = await apiFetch(
        "/examples",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            rating,
            review_text:
              reviewText ||
              "(no written review)",
            reply_text: replyText,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          describeApiError(data.error)
        );
      }

      setSavedExampleIds((old) => ({
        ...old,
        [key]: true,
      }));
    } catch (error) {
      setGoogleError(
        getErrorMessage(
          error,
          "Could not save that as an example."
        )
      );
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
        const response = await apiFetch(
          "/post-reply",
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
      {user &&
        user.connected &&
        !user.consented && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
            <div className="max-w-lg bg-white p-7">
              <h2 className="text-xl font-bold">
                Before you post replies
              </h2>

              <p className="mt-4 text-sm leading-6 text-[#63666D]">
                Smart Repute drafts replies to
                your Google reviews using AI.
                Nothing is ever posted to your
                Google Business Profile until
                you&apos;ve reviewed and
                approved it yourself. By
                continuing, you authorize Smart
                Repute to post replies to your
                Business Profile on your behalf,
                only for the ones you
                approve, and you agree to our{" "}
                <a
                  href="/terms"
                  target="_blank"
                  className="underline"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  className="underline"
                >
                  Privacy Policy
                </a>
                . You can disconnect your
                Google account at any time from
                this page.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button
                  onClick={acceptConsent}
                  disabled={
                    acceptingConsent
                  }
                  className="bg-[#3552FF] px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {acceptingConsent
                    ? "Saving..."
                    : "Agree and continue"}
                </button>

                <button
                  onClick={signOut}
                  className="text-sm text-[#63666D] underline-offset-2 hover:underline"
                >
                  Sign out instead
                </button>
              </div>
            </div>
          </div>
        )}

      {showTemplatesPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto bg-white p-7">
            <h2 className="text-xl font-bold">
              Reply templates
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#63666D]">
              Optional. Write your own
              greeting and sign-off for
              each kind of review --
              include{" "}
              <code className="bg-black/5 px-1">
                {"{body}"}
              </code>{" "}
              exactly where the AI-written
              paragraph should go. Leave
              any of these blank to let
              the AI write the complete
              reply, as it does now.
            </p>

            {templatesLoading ? (
              <p className="mt-6 text-sm text-[#63666D]">
                Loading...
              </p>
            ) : (
              <div className="mt-6 flex flex-col gap-5">
                <TemplateField
                  label="5-star reviews"
                  value={
                    templates.five_star
                  }
                  onChange={(v) =>
                    setTemplates(
                      (old) => ({
                        ...old,
                        five_star: v,
                      })
                    )
                  }
                  placeholder={`Thank you for the wonderful review!\n\n{body}\n\nWarm regards,\nThe Team`}
                />

                <TemplateField
                  label="2, 3 and 4-star reviews"
                  value={
                    templates.middle
                  }
                  onChange={(v) =>
                    setTemplates(
                      (old) => ({
                        ...old,
                        middle: v,
                      })
                    )
                  }
                  placeholder={`Thank you for your feedback.\n\n{body}\n\nWarm regards,\nThe Team`}
                />

                <TemplateField
                  label="1-star reviews"
                  value={
                    templates.one_star
                  }
                  onChange={(v) =>
                    setTemplates(
                      (old) => ({
                        ...old,
                        one_star: v,
                      })
                    )
                  }
                  placeholder={`Thank you for sharing this.\n\n{body}\n\nWarm regards,\nThe Team`}
                />
              </div>
            )}

            {templatesError && (
              <p className="mt-4 text-sm text-red-600">
                {templatesError}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                onClick={saveTemplates}
                disabled={
                  templatesSaving ||
                  templatesLoading
                }
                className="bg-[#3552FF] px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {templatesSaving
                  ? "Saving..."
                  : "Save templates"}
              </button>

              <button
                onClick={() =>
                  setShowTemplatesPanel(
                    false
                  )
                }
                className="text-sm text-[#63666D] underline-offset-2 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="relative overflow-hidden bg-[#0B0C10] text-[#FAFAF8]">
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-16 md:px-10 md:pb-28 md:pt-20">
          <div className="flex items-center gap-4 md:gap-6">
            <BrandMark className="h-14 w-14 shrink-0 md:h-24 md:w-24" />

            <h1 className="text-[15vw] font-[900] leading-[0.86] tracking-[-0.05em] sm:text-[96px] md:text-[124px]">
              SMART
              <br />
              REPUTE
            </h1>
          </div>

          <p className="mt-6 text-lg font-medium text-white/80 md:text-xl">
            Your AI Reputation Manager
          </p>

          <p className="mt-2 text-sm text-white/45">
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
                loadingReviews || !authChecked
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
                onClick={() =>
                  loadReviewsForLocation(
                    googleAccountId,
                    googleLocationId
                  )
                }
                disabled={
                  loadingReviews
                }
                className="border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition hover:border-white/50"
              >
                Refresh reviews
              </button>
            )}

            {googleConnected &&
              locations.length > 1 && (
                <button
                  onClick={() =>
                    loadGoogleReviews({
                      forcePicker: true,
                    })
                  }
                  disabled={
                    loadingReviews
                  }
                  className="px-2 py-3.5 text-sm text-white/50 underline-offset-2 hover:underline"
                >
                  Switch business
                </button>
              )}
          </div>

          {user && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/50">
              <span>Signed in as {user.email}</span>

              {googleConnected &&
                locations.find(
                  (loc) =>
                    loc.id === googleLocationId
                ) && (
                  <span>
                    Business:{" "}
                    {
                      locations.find(
                        (loc) =>
                          loc.id ===
                          googleLocationId
                      )?.title
                    }
                  </span>
                )}

              {googleConnected && (
                <button
                  onClick={
                    openTemplatesPanel
                  }
                  className="underline-offset-2 hover:text-white hover:underline"
                >
                  Reply templates
                </button>
              )}

              {googleConnected &&
                locations.find(
                  (loc) =>
                    loc.id ===
                    googleLocationId
                )?.reviewLink && (
                  <button
                    onClick={() =>
                      setShowReviewLink(
                        true
                      )
                    }
                    className="underline-offset-2 hover:text-white hover:underline"
                  >
                    Get more reviews
                  </button>
                )}

              <button
                onClick={signOut}
                className="underline-offset-2 hover:text-white hover:underline"
              >
                Sign out
              </button>

              <button
                onClick={disconnectAccount}
                className="underline-offset-2 hover:text-white hover:underline"
              >
                Disconnect
              </button>
            </div>
          )}

          {googleError && (
            <div className="mt-6 max-w-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">
              {googleError}
            </div>
          )}

          {showLocationPicker && (
            <div className="mt-6 max-w-xl border border-white/20 bg-white/5 p-5">
              <p className="mb-4 text-sm font-semibold text-white">
                This account manages more
                than one business -- choose
                one:
              </p>

              <div className="flex flex-col gap-2">
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() =>
                      chooseLocation(loc)
                    }
                    className="border border-white/20 px-4 py-3 text-left transition hover:border-[#3552FF]"
                  >
                    <div className="text-sm font-medium text-white">
                      {loc.title}
                    </div>

                    {loc.address && (
                      <div className="mt-0.5 text-xs text-white/50">
                        {loc.address}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showReviewLink &&
            (() => {
              const current =
                locations.find(
                  (loc) =>
                    loc.id ===
                    googleLocationId
                );

              if (
                !current?.reviewLink
              ) {
                return null;
              }

              return (
                <div className="mt-6 max-w-xl border border-white/20 bg-white/5 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-semibold text-white">
                      Share this link to
                      collect more Google
                      reviews
                    </p>

                    <button
                      onClick={() =>
                        setShowReviewLink(
                          false
                        )
                      }
                      className="text-xs text-white/50 hover:text-white"
                    >
                      Close
                    </button>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-white/50">
                    Send this to every
                    patient -- texting it
                    only to people you
                    think will leave a
                    good review isn&apos;t
                    allowed under
                    Google&apos;s policies.
                  </p>

                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                        current.reviewLink
                      )}`}
                      alt="QR code to leave a Google review"
                      width={120}
                      height={120}
                      className="bg-white p-2"
                    />

                    <div className="flex-1">
                      <div className="break-all border border-white/20 bg-black/20 p-3 text-xs text-white/70">
                        {
                          current.reviewLink
                        }
                      </div>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            current.reviewLink
                          );
                        }}
                        className="mt-3 border border-white/25 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/50"
                      >
                        Copy link
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
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
                        <span className="text-[#F5B700]">
                          {"★".repeat(
                            review.rating
                          )}
                        </span>
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

                            <button
                              onClick={() =>
                                saveAsExample(
                                  review.rating,
                                  review.review,
                                  review.existing_reply!,
                                  `existing-${review.id}`
                                )
                              }
                              disabled={
                                savedExampleIds[
                                  `existing-${review.id}`
                                ]
                              }
                              className="mt-3 text-xs text-[#3552FF] underline-offset-2 hover:underline disabled:text-[#63666D] disabled:no-underline"
                            >
                              {savedExampleIds[
                                `existing-${review.id}`
                              ]
                                ? "Saved as example"
                                : "Save as style example"}
                            </button>
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

                            {status ===
                              "posted" && (
                              <button
                                onClick={() =>
                                  saveAsExample(
                                    review.rating,
                                    review.review,
                                    replies[
                                      review.id
                                    ],
                                    `own-${review.id}`
                                  )
                                }
                                disabled={
                                  savedExampleIds[
                                    `own-${review.id}`
                                  ]
                                }
                                className="px-2 py-2.5 text-sm text-[#3552FF] disabled:text-[#63666D]"
                              >
                                {savedExampleIds[
                                  `own-${review.id}`
                                ]
                                  ? "Saved as example"
                                  : "Save as style example"}
                              </button>
                            )}
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

function BrandMark({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <path
          id="rp-star"
          d="M0,-10 L2.35,-3.24 L9.51,-3.09 L3.80,1.24 L5.88,8.09 L0,4 L-5.88,8.09 L-3.80,1.24 L-9.51,-3.09 L-2.35,-3.24 Z"
        />
      </defs>

      <line
        x1="10"
        y1="86"
        x2="82"
        y2="16"
        stroke="#3552FF"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <path
        d="M82,16 L69,16 M82,16 L82,29"
        stroke="#3552FF"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <use
        href="#rp-star"
        transform="translate(14,84) scale(0.55)"
        fill="#3552FF"
      />
      <use
        href="#rp-star"
        transform="translate(31,67) scale(0.7)"
        fill="#3552FF"
      />
      <use
        href="#rp-star"
        transform="translate(48,50) scale(0.85)"
        fill="#3552FF"
      />
      <use
        href="#rp-star"
        transform="translate(65,33) scale(1.0)"
        fill="#3552FF"
      />
      <use
        href="#rp-star"
        transform="translate(84,15) scale(1.15)"
        fill="#3552FF"
      />
    </svg>
  );
}

function TemplateField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        rows={4}
        className="mt-2 w-full resize-y border border-black/15 p-3 font-mono text-sm focus:border-[#3552FF] focus:outline-none"
      />
    </div>
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
