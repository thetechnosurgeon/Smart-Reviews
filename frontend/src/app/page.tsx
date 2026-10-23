"use client";

import { useEffect, useState } from "react";

import ArrowIcon from "./components/ArrowIcon";
import Footer from "./components/Footer";
import Pagination from "./components/Pagination";
import {
  AboutSection,
  FaqSection,
  GoogleDataSection,
  StepsSection,
} from "./components/PublicInfo";
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
  recentMix,
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
    recentPace(reviews.map((review) => review.created)),
    recentMix(
      reviews.map((review) => ({
        rating: review.rating,
        created: review.created,
      }))
    )
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

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: reviews.length },
    { key: "unanswered", label: "Unanswered", count: unansweredCount },
    { key: "attention", label: "Needs attention", count: attentionCount },
    { key: "draft", label: "Replies ready", count: draftedCount },
    { key: "approved", label: "Approved", count: approvedCount },
    { key: "posted", label: "Replied", count: postedCount },
  ];

  const ratingTabs: RatingFilter[] = ["all", 5, 4, 3, 2, 1];

  const locationPicker = showLocationPicker && (
    <div className="picker">
      <p
        className="hero-legal"
        style={{ marginBottom: 14 }}
      >
        This account manages more than one business. Choose one:
      </p>

      {locations.map((loc) => (
        <button key={loc.id} onClick={() => chooseLocation(loc)}>
          <b>{loc.title}</b>
          {loc.address && <small>{loc.address}</small>}
        </button>
      ))}
    </div>
  );

  return (
    <main>
      {user && user.connected && !user.consented && (
        <div className="modal">
          <div className="modal-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mark" src="/logo-mark.png" alt="" />

            <h2>Before you post replies</h2>

            <p>
              Smart Repute drafts replies to your Google reviews using AI.
              Nothing is ever posted to your Google Business Profile until
              you have reviewed and approved it yourself. By continuing,
              you authorize Smart Repute to post replies to your Business
              Profile on your behalf, only for the ones you approve, and
              you agree to our{" "}
              <a href="/terms" target="_blank">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank">
                Privacy Policy
              </a>
              . You can disconnect your Google account at any time from
              this page.
            </p>

            <div className="modal-actions">
              <button
                className="btn btn--blue"
                onClick={acceptConsent}
                disabled={acceptingConsent}
              >
                {acceptingConsent ? "Saving\u2026" : "Agree and continue"}
                {!acceptingConsent && <ArrowIcon />}
              </button>

              <button className="textbtn" onClick={signOut}>
                Sign out instead
              </button>
            </div>
          </div>
        </div>
      )}

      {showTemplatesPanel && (
        <div className="modal">
          <div className="modal-card">
            <h2>Reply templates</h2>

            <p>
              Optional. Write your own greeting and sign-off for each kind
              of review. Include <code>{"{body}"}</code> exactly where the
              AI-written paragraph should go. Leave any of these blank to
              let the AI write the complete reply.
            </p>

            {templatesLoading ? (
              <p>Loading...</p>
            ) : (
              <>
                <TemplateField
                  label="5-star reviews"
                  value={templates.five_star}
                  onChange={(v) =>
                    setTemplates((old) => ({ ...old, five_star: v }))
                  }
                  placeholder={`Thank you for the wonderful review!\n\n{body}\n\nWarm regards,\nThe Team`}
                />

                <TemplateField
                  label="2, 3 and 4-star reviews"
                  value={templates.middle}
                  onChange={(v) =>
                    setTemplates((old) => ({ ...old, middle: v }))
                  }
                  placeholder={`Thank you for your feedback.\n\n{body}\n\nWarm regards,\nThe Team`}
                />

                <TemplateField
                  label="1-star reviews"
                  value={templates.one_star}
                  onChange={(v) =>
                    setTemplates((old) => ({ ...old, one_star: v }))
                  }
                  placeholder={`Thank you for sharing this.\n\n{body}\n\nWarm regards,\nThe Team`}
                />
              </>
            )}

            {templatesError && (
              <p style={{ color: "#b9473f" }}>{templatesError}</p>
            )}

            <div className="modal-actions">
              <button
                className="btn btn--green"
                onClick={saveTemplates}
                disabled={templatesSaving || templatesLoading}
              >
                {templatesSaving ? "Saving\u2026" : "Save templates"}
                {!templatesSaving && <ArrowIcon />}
              </button>

              <button
                className="textbtn"
                onClick={() => setShowTemplatesPanel(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showReviewLink && reviewLink && (
        <div className="modal">
          <div className="modal-card">
            <div className="modal-head">
              <h2>Get more reviews</h2>

              <button
                className="textbtn"
                style={{ fontSize: 14, color: "#5c5e62" }}
                onClick={() => setShowReviewLink(false)}
              >
                Close
              </button>
            </div>

            <p>
              Share this link with every customer. Sending it only to
              people you expect to leave a good review is not allowed
              under Google&apos;s policies.
            </p>

            {!reviewLinkAck ? (
              <div data-testid="review-link-notice" className="note">
                <strong>Before you share this link</strong>

                <p style={{ marginTop: 8, fontSize: 13 }}>
                  Google requires you to ask every customer, never choose
                  who to ask, and never offer anything in return. If you
                  are a doctor or hospital in India, the NMC advertising
                  guidelines issued on 6 October 2026 restrict requesting
                  patient reviews for promotion, so check with your
                  compliance advisor first.
                </p>

                <div className="modal-actions" style={{ marginTop: 18 }}>
                  <button
                    className="btn btn--ink btn--sm"
                    onClick={() => setReviewLinkAck(true)}
                  >
                    I understand, show the link
                  </button>
                </div>
              </div>
            ) : (
              <div className="qr">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                    reviewLink
                  )}`}
                  alt="QR code to leave a Google review"
                  width={132}
                  height={132}
                />

                <div>
                  <div className="linkbox">{reviewLink}</div>

                  <button
                    className="btn btn--blue btn--sm"
                    style={{ marginTop: 14 }}
                    onClick={() => {
                      navigator.clipboard.writeText(reviewLink);
                    }}
                  >
                    Copy link
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!googleConnected ? (
        <>
          <SiteNav>
            <a href="#about" className="hide-s">
              Features
            </a>
            <a href="#how-it-works" className="hide-s">
              How it works
            </a>
            <a href="#google-data" className="hide-m">
              Your Google data
            </a>
            <a href="/privacy" className="hide-s">
              Privacy
            </a>

            {user ? (
              <button
                className="btn btn--ghost-light btn--sm"
                onClick={signOut}
              >
                Sign out
              </button>
            ) : (
              <button
                className="btn btn--ghost-light btn--sm"
                onClick={connectGoogle}
                disabled={!authChecked}
              >
                Connect
              </button>
            )}
          </SiteNav>

          <section className="hero dark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="hero-art"
              src="/logo-mark-dark.png"
              alt=""
            />

            <div className="wrap hero-body">
              <p className="eyebrow">AI Reputation Manager</p>

              <h1 className="h1">AI Replies &amp; Reputation Growth</h1>

              <p className="lead">
                Connect your Google Business Profile, get a reply drafted
                for every review, approve what is right, and publish in
                one click. Nothing goes live until you say so.
              </p>

              <div className="hero-cta">
                <button
                  className="btn btn--blue"
                  onClick={connectGoogle}
                  disabled={loadingReviews || !authChecked}
                >
                  {loadingReviews
                    ? "Connecting\u2026"
                    : "Connect Google Business Profile"}
                  <ArrowIcon />
                </button>

                <a className="btn btn--ghost-light" href="#about">
                  Learn how it works
                </a>
              </div>

              <p className="hero-legal">
                By connecting, you agree to our{" "}
                <a href="/terms">Terms</a> and{" "}
                <a href="/privacy">Privacy Policy</a>.{" "}
                <a href="#google-data">Why we ask for Google access</a>
              </p>

              {user && (
                <p className="hero-legal" style={{ marginTop: 12 }}>
                  Signed in as {user.email}.{" "}
                  <button className="textbtn" onClick={disconnectAccount}>
                    Disconnect
                  </button>
                </p>
              )}

              {googleError && <p className="alert">{googleError}</p>}

              {locationPicker}
            </div>
          </section>

          <AboutSection />
          <StepsSection />
          <GoogleDataSection />
          <FaqSection />
        </>
      ) : (
        <>
          <SiteNav solid>
            <a href="#reviews" className="hide-s">
              Reviews
            </a>

            <button
              className="textbtn hide-s"
              onClick={openTemplatesPanel}
            >
              Reply templates
            </button>

            <button
              className="textbtn hide-s"
              onClick={disconnectAccount}
            >
              Disconnect
            </button>

            <button
              className="btn btn--ghost-light btn--sm"
              onClick={signOut}
            >
              Sign out
            </button>
          </SiteNav>

          <section className="dash-hero dark">
            <div className="wrap">
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
                      className="btn btn--gold"
                      onClick={openReviewLink}
                    >
                      Get more reviews
                      <ArrowIcon />
                    </button>
                  ) : undefined
                }
              />

              {googleError && <p className="alert">{googleError}</p>}

              {locationPicker}

              <div className="dash-tools">
                <span>Signed in as {user?.email}</span>

                <button
                  className="textbtn"
                  onClick={() =>
                    loadReviewsForLocation(
                      googleAccountId,
                      googleLocationId
                    )
                  }
                  disabled={loadingReviews}
                >
                  Refresh reviews
                </button>

                {locations.length > 1 && (
                  <button
                    className="textbtn"
                    onClick={() =>
                      loadGoogleReviews({ forcePicker: true })
                    }
                    disabled={loadingReviews}
                  >
                    Switch business
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="wrap">
            <div className="stats">
              <Stat label="Reviews" value={reviews.length} color="#2c5fb3" />
              <Stat label="Need a reply" value={pendingCount} color="#e2bd4c" />
              <Stat label="Replies ready" value={draftedCount} color="#d58a3c" />
              <Stat label="Approved" value={approvedCount} color="#3a966a" />
              <Stat label="Replied" value={postedCount} color="#d8a73a" />
            </div>
          </section>

          <section id="reviews" className="wrap reviews">
            <h2>Reviews</h2>

            <div className="actions">
              <button
                className="btn btn--blue"
                onClick={generateCurrentPage}
                disabled={generatingAll || pendingOnPage.length === 0}
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
                className="btn btn--green"
                onClick={postApprovedReplies}
                disabled={posting || approvedCount === 0 || !googleConnected}
              >
                {posting
                  ? "Posting\u2026"
                  : `Post approved${
                      approvedCount ? ` (${approvedCount})` : ""
                    }`}
                <ArrowIcon />
              </button>
            </div>

            {notice && <p className="note">{notice}</p>}

            <p className="hint">
              Each page holds {PAGE_SIZE} reviews. Generate and approve
              this page, then move on to the next. Approved replies from
              every page are posted together.
            </p>

            <div className="tabs" style={{ marginTop: 40 }}>
              {tabs.map((t) => (
                <button
                  key={t.key}
                  className="tab"
                  aria-pressed={filter === t.key}
                  onClick={() => changeFilter(t.key)}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>

            <div className="tabs tabs--sub">
              {ratingTabs.map((rating) => (
                <button
                  key={rating}
                  className="tab"
                  aria-pressed={ratingFilter === rating}
                  onClick={() => changeRating(rating)}
                >
                  {rating === "all" ? "All ratings" : `${rating}\u2605`}
                </button>
              ))}
            </div>

            <Pagination
              page={currentPage}
              totalPages={totalPages}
              total={filteredReviews.length}
              pageSize={PAGE_SIZE}
              onPrev={() => goToPage(currentPage - 1)}
              onNext={() => goToPage(currentPage + 1)}
              disabled={loadingReviews || generatingAll}
            />

            {loadingReviews ? (
              <div className="empty">Loading reviews...</div>
            ) : filteredReviews.length === 0 ? (
              <div className="empty">
                {reviews.length === 0
                  ? "No reviews found for this business yet."
                  : filter === "unanswered"
                  ? "You are all caught up. Every review here has a reply."
                  : "No reviews match this filter."}
              </div>
            ) : (
              <div>
                {pagedReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    status={statuses[review.id]}
                    reply={replies[review.id]}
                    error={errors[review.id]}
                    savedOwn={Boolean(savedExampleIds[`own-${review.id}`])}
                    savedExisting={Boolean(
                      savedExampleIds[`existing-${review.id}`]
                    )}
                    onGenerate={() => generateReply(review)}
                    onApprove={() => approveReply(review)}
                    onSkip={() => skipReply(review.id)}
                    onEdit={(value) => editReply(review.id, value)}
                    onSaveExample={(kind) =>
                      saveAsExample(
                        review.rating,
                        review.review,
                        kind === "own"
                          ? replies[review.id] || ""
                          : review.existing_reply || "",
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
                onPrev={() => goToPage(currentPage - 1)}
                onNext={() => goToPage(currentPage + 1)}
                disabled={loadingReviews || generatingAll}
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
    <div className="field">
      <label>{label}</label>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="stat">
      <b>{value}</b>

      <span>
        <i className="dot" style={{ background: color }} />
        {label}
      </span>
    </div>
  );
}
