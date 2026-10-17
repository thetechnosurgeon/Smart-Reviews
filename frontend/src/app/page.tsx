"use client";

import { useEffect, useState } from "react";

import ArrowIcon from "./components/ArrowIcon";
import Footer from "./components/Footer";
import Pagination from "./components/Pagination";
import RatingHeader from "./components/RatingHeader";
import ReviewCard from "./components/ReviewCard";
import SiteNav from "./components/SiteNav";
import {
  PAGE_SIZE,
  clampPage,
  pageCount,
  pageSlice,
} from "./lib/pagination";
import {
  buildStats,
  clampTarget,
  DEFAULT_TARGET_TENTHS,
  planFor,
  readStoredTarget,
  recentPace,
  starCounts,
  storeTarget,
} from "./lib/target";

type Review = {
  id: string;
  reviewer: string;
  rating: number;
  review: string;
  created?: string | null;
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
  is_admin?: boolean;
};

type Templates = {
  five_star: string;
  middle: string;
  one_star: string;
};

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

  // Google's own aggregate for the connected business (what its profile shows)
  const [googleRating, setGoogleRating] = useState<{
    average: number | null;
    total: number | null;
  }>({ average: null, total: null });

  const [targetTenths, setTargetTenths] = useState(
    DEFAULT_TARGET_TENTHS
  );

  const [reviewLinkAck, setReviewLinkAck] = useState(false);
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
    useState<Filter>("unanswered");

  const [page, setPage] = useState(1);

  const [notice, setNotice] = useState("");

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
    setPage(1);
    setNotice("");
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

      const apiAverage =
        typeof reviewData.average_rating === "number"
          ? reviewData.average_rating
          : null;

      const apiTotal =
        typeof reviewData.total_reviews === "number"
          ? reviewData.total_reviews
          : null;

      setGoogleRating({
        average: apiAverage,
        total: apiTotal,
      });

      setTargetTenths(
        readStoredTarget(
          locationId,
          buildStats(
            loadedReviews.map(
              (review: Review) => review.rating
            ),
            apiAverage,
            apiTotal
          ).average
        )
      );

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
  ): Promise<"ok" | "limit" | "error"> {
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

      if (
        response.status === 429 &&
        data.code === "daily_limit"
      ) {
        // Not an error on this review -- put it back as pending and tell
        // the person once, instead of failing every review in the batch.
        setStatuses((old) => {
          const next = { ...old };
          delete next[review.id];
          return next;
        });

        setNotice(
          describeApiError(data.error)
        );

        return "limit";
      }

      if (!response.ok || data.error) {
        throw new Error(
          describeApiError(
            data.error ||
              "Reply generation failed"
          )
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

      return "ok";
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

      return "error";
    }
  }

  async function generateReviews(
    targetReviews: Review[]
  ) {
    if (!targetReviews.length) {
      return;
    }

    setNotice("");
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

      const outcome = await generateReply(
        targetReviews[i]
      );

      if (outcome === "limit") {
        break;
      }
    }

    setGeneratingAll(false);
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

  const pendingCount = reviews.filter((review) => {
    const status = statuses[review.id];
    return !status || status === "error";
  }).length;

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

  const filteredReviews =
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

  // 25 reviews per page. The page number is clamped so it stays valid when
  // the list shrinks (for example after replies are posted).
  const totalPages = pageCount(
    filteredReviews.length
  );

  const currentPage = clampPage(
    page,
    filteredReviews.length
  );

  const pagedReviews = pageSlice(
    filteredReviews,
    currentPage
  );

  const pendingOnPage =
    pagedReviews.filter((review) => {
      const status =
        statuses[review.id];

      return (
        !status || status === "error"
      );
    });

  const ratingStats = buildStats(
    reviews.map((review) => review.rating),
    googleRating.average,
    googleRating.total
  );

  const starDistribution = starCounts(
    reviews.map((review) => review.rating)
  );

  const ratingPlan = planFor(
    ratingStats,
    targetTenths,
    recentPace(reviews.map((review) => review.created))
  );

  const currentBusiness = locations.find(
    (loc) => loc.id === googleLocationId
  );

  const reviewLink =
    currentBusiness?.reviewLink || "";

  function changeTarget(next: number) {
    const clamped = clampTarget(next);

    setTargetTenths(clamped);
    storeTarget(googleLocationId, clamped);
  }

  function connectGoogle() {
    window.location.href = `${API_URL}/auth/google`;
  }

  function changeFilter(next: Filter) {
    setFilter(next);
    setPage(1);
  }

  function changeRating(next: RatingFilter) {
    setRatingFilter(next);
    setPage(1);
  }

  function goToPage(next: number) {
    setPage(
      clampPage(next, filteredReviews.length)
    );

    document
      .getElementById("reviews")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  async function generateCurrentPage() {
    await generateReviews(pendingOnPage);
  }

  function openReviewLink() {
    setShowReviewLink(true);
  }

  return (
    <main className="min-h-screen bg-[#F4F7FC] text-[#0B0C10]">
      {user &&
        user.connected &&
        !user.consented && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
            <div className="max-w-lg rounded-2xl bg-white p-7 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-mark.png"
                alt=""
                className="h-12 w-auto"
              />

              <h2 className="mt-4 text-xl font-bold">
                Before you post replies
              </h2>

              <p className="mt-4 text-sm leading-6 text-[#5A6B86]">
                Smart Repute drafts replies to
                your Google reviews using AI.
                Nothing is ever posted to your
                Google Business Profile until
                you have reviewed and approved
                it yourself. By continuing, you
                authorize Smart Repute to post
                replies to your Business Profile
                on your behalf, only for the
                ones you approve, and you agree
                to our{" "}
                <a
                  href="/terms"
                  target="_blank"
                  className="font-medium text-[#1957C9] underline"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  className="font-medium text-[#1957C9] underline"
                >
                  Privacy Policy
                </a>
                . You can disconnect your Google
                account at any time from this
                page.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button
                  onClick={acceptConsent}
                  disabled={acceptingConsent}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1957C9] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2F7DE1] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {acceptingConsent
                    ? "Saving\u2026"
                    : "Agree and continue"}
                  {!acceptingConsent && (
                    <ArrowIcon />
                  )}
                </button>

                <button
                  onClick={signOut}
                  className="text-sm text-[#5A6B86] underline-offset-2 hover:underline"
                >
                  Sign out instead
                </button>
              </div>
            </div>
          </div>
        )}

      {showTemplatesPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-7 shadow-2xl">
            <h2 className="text-xl font-bold">
              Reply templates
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#5A6B86]">
              Optional. Write your own greeting
              and sign-off for each kind of
              review. Include{" "}
              <code className="rounded bg-black/5 px-1">
                {"{body}"}
              </code>{" "}
              exactly where the AI-written
              paragraph should go. Leave any of
              these blank to let the AI write
              the complete reply.
            </p>

            {templatesLoading ? (
              <p className="mt-6 text-sm text-[#5A6B86]">
                Loading...
              </p>
            ) : (
              <div className="mt-6 flex flex-col gap-5">
                <TemplateField
                  label="5-star reviews"
                  value={templates.five_star}
                  onChange={(v) =>
                    setTemplates((old) => ({
                      ...old,
                      five_star: v,
                    }))
                  }
                  placeholder={`Thank you for the wonderful review!\n\n{body}\n\nWarm regards,\nThe Team`}
                />

                <TemplateField
                  label="2, 3 and 4-star reviews"
                  value={templates.middle}
                  onChange={(v) =>
                    setTemplates((old) => ({
                      ...old,
                      middle: v,
                    }))
                  }
                  placeholder={`Thank you for your feedback.\n\n{body}\n\nWarm regards,\nThe Team`}
                />

                <TemplateField
                  label="1-star reviews"
                  value={templates.one_star}
                  onChange={(v) =>
                    setTemplates((old) => ({
                      ...old,
                      one_star: v,
                    }))
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
                className="inline-flex items-center gap-2 rounded-xl bg-[#16A34A] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#15803D] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {templatesSaving
                  ? "Saving\u2026"
                  : "Save templates"}
                {!templatesSaving && (
                  <ArrowIcon />
                )}
              </button>

              <button
                onClick={() =>
                  setShowTemplatesPanel(false)
                }
                className="text-sm text-[#5A6B86] underline-offset-2 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showReviewLink && reviewLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-bold">
                Get more reviews
              </h2>

              <button
                onClick={() =>
                  setShowReviewLink(false)
                }
                className="text-sm text-[#5A6B86] hover:text-[#0B0C10]"
              >
                Close
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-[#5A6B86]">
              Share this link with every
              customer. Sending it only to people
              you expect to leave a good review is
              not allowed under Google&apos;s
              policies.
            </p>

            {!reviewLinkAck ? (
              <div
                data-testid="review-link-notice"
                className="mt-5 rounded-xl border border-[#F2A100]/40 bg-[#FFD84D]/20 p-4"
              >
                <p className="text-sm font-semibold text-[#7A5200]">
                  Before you share this link
                </p>

                <p className="mt-2 text-xs leading-5 text-[#5A4500]">
                  Google requires you to ask every
                  customer, never choose who to ask,
                  and never offer anything in return.
                  If you are a doctor or hospital in
                  India, the NMC advertising
                  guidelines issued on 6 October 2026
                  restrict requesting patient reviews
                  for promotion, so check with your
                  compliance advisor first.
                </p>

                <button
                  onClick={() =>
                    setReviewLinkAck(true)
                  }
                  className="mt-3 rounded-lg bg-[#0B0C10] px-4 py-2 text-xs font-semibold text-white transition hover:bg-black/80"
                >
                  I understand, show the link
                </button>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                    reviewLink
                  )}`}
                  alt="QR code to leave a Google review"
                  width={120}
                  height={120}
                  className="rounded-lg border border-black/10 bg-white p-2"
                />

                <div className="flex-1">
                  <div className="break-all rounded-lg border border-black/10 bg-black/[0.03] p-3 text-xs text-[#0B0C10]/80">
                    {reviewLink}
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        reviewLink
                      );
                    }}
                    className="mt-3 rounded-lg bg-[#1957C9] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0B3A8C]"
                  >
                    Copy link
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <SiteNav>
        {googleConnected && (
          <a
            href="#reviews"
            className="rounded-lg px-3 py-2 transition hover:text-white"
          >
            Reviews
          </a>
        )}

        {user ? (
          <button
            onClick={signOut}
            className="rounded-lg border border-white/20 px-4 py-2 font-medium text-white transition hover:border-white/50"
          >
            Sign out
          </button>
        ) : (
          <button
            onClick={connectGoogle}
            disabled={!authChecked}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FFD84D] px-4 py-2 font-semibold text-[#0B0C10] transition hover:bg-[#F2A100] disabled:opacity-50"
          >
            Connect
            <ArrowIcon />
          </button>
        )}
      </SiteNav>

      <section
        className="relative overflow-hidden text-[#FAFAF8]"
        style={{
          background:
            "radial-gradient(1100px 480px at 88% -10%, rgba(47,125,225,0.38), transparent 60%), radial-gradient(800px 420px at 0% 110%, rgba(242,161,0,0.20), transparent 55%), linear-gradient(180deg, #0B0C10 0%, #0A1A3F 100%)",
        }}
      >
        <div
          className={`mx-auto grid max-w-7xl items-center gap-10 px-6 md:px-10 ${
            googleConnected
              ? "py-10 md:py-12"
              : "py-14 md:grid-cols-[1.1fr_0.9fr] md:py-24"
          }`}
        >
          {googleConnected && (
            <RatingHeader
              businessName={currentBusiness?.title || ""}
              average={ratingStats.average}
              total={ratingStats.n}
              distribution={starDistribution}
              plan={ratingPlan}
              exact={ratingStats.exact}
              onTargetChange={changeTarget}
              action={
                reviewLink ? (
                  <button
                    onClick={openReviewLink}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#FFD84D] px-6 py-3.5 text-base font-bold text-[#0B0C10] shadow-lg shadow-[#F2A100]/25 transition hover:bg-[#F2A100]"
                  >
                    Get more reviews
                    <ArrowIcon />
                  </button>
                ) : undefined
              }
            />
          )}

          <div>
            {!googleConnected && (
              <>
                <p className="inline-block rounded-full border border-[#FFD84D]/40 bg-[#FFD84D]/10 px-3 py-1 text-xs font-semibold text-[#FFD84D]">
                  AI Reputation Manager
                </p>

                <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] md:text-6xl">
                  AI Replies &amp;
                  <br />
                  <span
                    style={{
                      background:
                        "linear-gradient(90deg, #FFD84D, #F2A100)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    Reputation Growth
                  </span>
                </h1>

                <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">
                  Connect your Google Business
                  Profile, get a reply drafted for
                  every review, approve what is
                  right, and publish in one click.
                  Nothing goes live until you say
                  so.
                </p>
              </>
            )}

            <div
              className={`${
                googleConnected ? "" : "mt-8"
              } flex flex-wrap items-center gap-3`}
            >
              {!googleConnected && (
                <button
                  onClick={connectGoogle}
                  disabled={
                    loadingReviews ||
                    !authChecked
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1957C9] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#1957C9]/30 transition hover:bg-[#2F7DE1] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingReviews
                    ? "Connecting\u2026"
                    : "Connect Google Business Profile"}
                  <ArrowIcon />
                </button>
              )}

              {googleConnected && (
                <button
                  onClick={() =>
                    loadReviewsForLocation(
                      googleAccountId,
                      googleLocationId
                    )
                  }
                  disabled={loadingReviews}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/60 disabled:opacity-50"
                >
                  Refresh reviews
                  <ArrowIcon />
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
                    disabled={loadingReviews}
                    className="px-2 py-3.5 text-sm text-white/60 underline-offset-2 transition hover:text-white hover:underline"
                  >
                    Switch business
                  </button>
                )}
            </div>

            {user && (
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/55">
                <span>
                  Signed in as {user.email}
                </span>

                {googleConnected &&
                  currentBusiness && (
                    <span className="text-white/80">
                      Business:{" "}
                      {currentBusiness.title}
                    </span>
                  )}

                {googleConnected && (
                  <button
                    onClick={openTemplatesPanel}
                    className="underline-offset-2 hover:text-white hover:underline"
                  >
                    Reply templates
                  </button>
                )}

                <button
                  onClick={disconnectAccount}
                  className="underline-offset-2 hover:text-white hover:underline"
                >
                  Disconnect
                </button>
              </div>
            )}

            {googleError && (
              <div className="mt-6 max-w-xl rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">
                {googleError}
              </div>
            )}

            {showLocationPicker && (
              <div className="mt-6 max-w-xl rounded-2xl border border-white/20 bg-white/5 p-5">
                <p className="mb-4 text-sm font-semibold text-white">
                  This account manages more
                  than one business. Choose
                  one:
                </p>

                <div className="flex flex-col gap-2">
                  {locations.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() =>
                        chooseLocation(loc)
                      }
                      className="rounded-xl border border-white/20 px-4 py-3 text-left transition hover:border-[#FFD84D]"
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
          </div>

          {!googleConnected && (
            <div className="hidden justify-center md:flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-dark.png"
                alt="Smart Repute"
                className="w-full max-w-md"
              />
            </div>
          )}
        </div>
      </section>

      {!googleConnected && (
        <section className="mx-auto max-w-7xl px-6 py-16 md:px-10">
          <h2 className="text-center text-2xl font-bold tracking-[-0.02em] md:text-3xl">
            Three steps from review to reply
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                n: "1",
                title: "Connect",
                text: "Sign in with Google and pick your business. We never see your password.",
                color: "#1957C9",
              },
              {
                n: "2",
                title: "Generate",
                text: "Get a reply drafted for every review, 25 at a time, written to sound like you.",
                color: "#F2A100",
              },
              {
                n: "3",
                title: "Approve and post",
                text: "Edit if you like, approve each reply, then publish them all in one click.",
                color: "#16A34A",
              },
            ].map((step) => (
              <div
                key={step.n}
                className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm"
                style={{
                  borderTop: `4px solid ${step.color}`,
                }}
              >
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{
                    background: step.color,
                  }}
                >
                  {step.n}
                </span>

                <h3 className="mt-4 text-lg font-semibold">
                  {step.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-[#5A6B86]">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {googleConnected && (
        <>
          <section className="mx-auto max-w-7xl px-6 pt-10 md:px-10">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <Stat
                label="Reviews"
                value={reviews.length}
                accent="#1957C9"
              />
              <Stat
                label="Need a reply"
                value={pendingCount}
                accent="#FFD84D"
              />
              <Stat
                label="Replies ready"
                value={draftedCount}
                accent="#F97316"
              />
              <Stat
                label="Approved"
                value={approvedCount}
                accent="#16A34A"
              />
              <Stat
                label="Replied"
                value={postedCount}
                accent="#F2A100"
              />
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 pt-8 md:px-10">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={generateCurrentPage}
                disabled={
                  generatingAll ||
                  pendingOnPage.length === 0
                }
                className="inline-flex items-center gap-2 rounded-xl bg-[#1957C9] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#1957C9]/25 transition hover:bg-[#0B3A8C] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generatingAll
                  ? `Generating ${generationProgress.current}/${generationProgress.total}`
                  : `Generate replies for this page${
                      pendingOnPage.length
                        ? ` (${pendingOnPage.length})`
                        : ""
                    }`}
                <ArrowIcon />
              </button>

              <button
                onClick={postApprovedReplies}
                disabled={
                  posting ||
                  approvedCount === 0 ||
                  !googleConnected
                }
                className="inline-flex items-center gap-2 rounded-xl bg-[#16A34A] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#16A34A]/25 transition hover:bg-[#15803D] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {posting
                  ? "Posting\u2026"
                  : `Post approved${
                      approvedCount
                        ? ` (${approvedCount})`
                        : ""
                    }`}
                <ArrowIcon />
              </button>
            </div>

            {notice && (
              <p className="mt-4 rounded-xl border border-[#F2A100]/50 bg-[#FFD84D]/25 px-4 py-3 text-sm font-medium text-[#7A5200]">
                {notice}
              </p>
            )}

            <p className="mt-3 text-xs text-[#5A6B86]">
              Each page holds {PAGE_SIZE}{" "}
              reviews. Generate and approve this
              page, then move on to the next.
              Approved replies from every page
              are posted together.
            </p>
          </section>

          <section
            id="reviews"
            className="mx-auto max-w-7xl scroll-mt-24 px-6 pb-4 pt-12 md:px-10"
          >
            <h2 className="mb-6 text-3xl font-bold tracking-[-0.02em]">
              Reviews
            </h2>

            <div className="mb-4 flex flex-wrap gap-2">
              <FilterChip
                label={`All (${reviews.length})`}
                active={filter === "all"}
                onClick={() =>
                  changeFilter("all")
                }
              />
              <FilterChip
                label={`Unanswered (${unansweredCount})`}
                active={
                  filter === "unanswered"
                }
                onClick={() =>
                  changeFilter("unanswered")
                }
              />
              <FilterChip
                label={`Needs attention (${attentionCount})`}
                active={
                  filter === "attention"
                }
                onClick={() =>
                  changeFilter("attention")
                }
              />
              <FilterChip
                label={`Replies ready (${draftedCount})`}
                active={filter === "draft"}
                onClick={() =>
                  changeFilter("draft")
                }
              />
              <FilterChip
                label={`Approved (${approvedCount})`}
                active={
                  filter === "approved"
                }
                onClick={() =>
                  changeFilter("approved")
                }
              />
              <FilterChip
                label={`Replied (${postedCount})`}
                active={filter === "posted"}
                onClick={() =>
                  changeFilter("posted")
                }
              />
            </div>

            <div className="mb-2 flex flex-wrap gap-2">
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
                <FilterChip
                  key={rating}
                  label={
                    rating === "all"
                      ? "All ratings"
                      : `${rating}\u2605`
                  }
                  active={
                    ratingFilter === rating
                  }
                  onClick={() =>
                    changeRating(rating)
                  }
                />
              ))}
            </div>

            <Pagination
              page={currentPage}
              totalPages={totalPages}
              total={filteredReviews.length}
              pageSize={PAGE_SIZE}
              onPrev={() =>
                goToPage(currentPage - 1)
              }
              onNext={() =>
                goToPage(currentPage + 1)
              }
              disabled={
                loadingReviews || generatingAll
              }
            />

            {loadingReviews ? (
              <div className="rounded-2xl border border-black/10 bg-white py-16 text-center text-sm text-[#5A6B86]">
                Loading reviews...
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="rounded-2xl border border-black/10 bg-white py-16 text-center text-sm text-[#5A6B86]">
                {reviews.length === 0
                  ? "No reviews found for this business yet."
                  : filter === "unanswered"
                  ? "You are all caught up. Every review here has a reply."
                  : "No reviews match this filter."}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {pagedReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    status={statuses[review.id]}
                    reply={replies[review.id]}
                    error={errors[review.id]}
                    savedOwn={Boolean(
                      savedExampleIds[
                        `own-${review.id}`
                      ]
                    )}
                    savedExisting={Boolean(
                      savedExampleIds[
                        `existing-${review.id}`
                      ]
                    )}
                    onGenerate={() =>
                      generateReply(review)
                    }
                    onApprove={() =>
                      approveReply(review)
                    }
                    onSkip={() =>
                      skipReply(review.id)
                    }
                    onEdit={(value) =>
                      editReply(
                        review.id,
                        value
                      )
                    }
                    onSaveExample={(kind) =>
                      saveAsExample(
                        review.rating,
                        review.review,
                        kind === "own"
                          ? replies[review.id] ||
                              ""
                          : review.existing_reply ||
                              "",
                        `${kind}-${review.id}`
                      )
                    }
                  />
                ))}
              </div>
            )}

            {filteredReviews.length > 0 && (
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                total={filteredReviews.length}
                pageSize={PAGE_SIZE}
                onPrev={() =>
                  goToPage(currentPage - 1)
                }
                onNext={() =>
                  goToPage(currentPage + 1)
                }
                disabled={
                  loadingReviews ||
                  generatingAll
                }
              />
            )}
          </section>
        </>
      )}

      <Footer
        signedIn={Boolean(user)}
        connected={googleConnected}
        isAdmin={Boolean(user?.is_admin)}
        canOpenReviewLink={Boolean(reviewLink)}
        onConnect={connectGoogle}
        onSignOut={signOut}
        onDisconnect={disconnectAccount}
        onOpenTemplates={openTemplatesPanel}
        onOpenReviewLink={openReviewLink}
      />
    </main>
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
        className="mt-2 w-full resize-y rounded-xl border border-black/15 p-3 font-mono text-sm focus:border-[#1957C9] focus:outline-none"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl border border-black/10 bg-white px-5 py-4 shadow-sm"
      style={{
        borderTop: `3px solid ${accent}`,
      }}
    >
      <div className="text-3xl font-bold">
        {value}
      </div>

      <div className="mt-1 text-sm text-[#5A6B86]">
        {label}
      </div>
    </div>
  );
}

function FilterChip({
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
          ? "rounded-full bg-[#0B0C10] px-4 py-2 text-sm font-medium text-white"
          : "rounded-full border border-black/15 bg-white px-4 py-2 text-sm text-[#5A6B86] transition hover:border-[#1957C9]/50 hover:text-[#1957C9]"
      }
    >
      {label}
    </button>
  );
}
