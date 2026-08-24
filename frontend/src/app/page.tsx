"use client";
import ReviewCard from "../components/ReviewCard";
import { useEffect, useState } from "react";

export default function Home() {
  const [replies, setReplies] = useState<{ [key: string]: string }>({});
  const [statuses, setStatuses] = useState<{ [key: string]: string }>({});
  const [reviews, setReviews] = useState<any[]>([]);
  
  async function generateReply(reviewId: string, reviewText: string) {
  const response = await fetch(
     "http://" + "127.0.0.1:8000/generate-reply",
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

  setReplies((oldReplies) => ({
    ...oldReplies,
    [reviewId]: data.reply,
  }));
}

async function approveReply(reviewId: string) {
  const response = await fetch(
    "http://" + "127.0.0.1:8000/approve-reply",
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

  setStatuses((oldStatuses) => ({
    ...oldStatuses,
    [reviewId]: data.status,
  }));
}

async function postApprovedReplies() {
  for (const review of reviews) {
    if (statuses[review.id] === "approved") {
      await fetch(
        "http://" + "127.0.0.1:8000/post-reply",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            review_id: review.id,
            reply: replies[review.id],
          }),
        }
      );

      setStatuses((oldStatuses) => ({
        ...oldStatuses,
        [review.id]: "posted",
      }));
    }
  }
}

useEffect(() => {
  async function loadReviews() {
    const response = await fetch(
      "http://" + "127.0.0.1:8000/reviews"
    );

    const data = await response.json();

    setReviews(data.reviews);
  }

  loadReviews();
}, []);

return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <h1 className="text-5xl font-bold">
          Smart Reviews
        </h1>

        <p className="mt-6 text-xl text-black">
          AI-assisted review response management for businesses.
        </p>

        <div className="mt-12 space-y-4 text-lg">
          <p>✓ Manage customer reviews in one place</p>
          <p>✓ Generate professional AI-assisted replies</p>
          <p>✓ Review and edit every response before posting</p>
          <p>✓ Connect with Google Business Profile</p>
        </div>

        <p className="mt-12 text- black">
          Smart Reviews helps businesses respond to customer feedback quickly
          while keeping the business owner in control.
        </p>

        <p className="mt-4 text-black">
          AI-generated replies are never posted without user approval.
        </p>

         <button
  onClick={() => reviews.forEach((review) =>
    generateReply(review.id, review.review)
  )}
>
  Generate all replies
</button>
<button onClick={postApprovedReplies}>
  Post approved replies
</button>

        <div>
  {reviews.map((review) => (
    <div key={review.id}>
      <h2>{review.reviewer}</h2>
      <p>{review.rating} stars</p>
      <p>{review.review}</p>
    <button onClick={() => generateReply(review.id, review.review)}>
  Generate reply
</button>

{replies[review.id] && (
  <>
    <textarea
      value={replies[review.id]}
      onChange={(e) =>
        setReplies((oldReplies) => ({
          ...oldReplies,
          [review.id]: e.target.value,
        }))
      }
    />

    <div>
      <button onClick={() => approveReply(review.id)}>
  Approve
</button>

<button
  onClick={() =>
    setStatuses((oldStatuses) => ({
      ...oldStatuses,
      [review.id]: "skipped",
    }))
  }
>
  Skip
</button>
{statuses[review.id] && (
  <p>Status: {statuses[review.id]}</p>
)}

    </div>
  </>
)}

    </div>
  ))}
</div>

        <p className="mt-12 text-sm text-black">
          drabhinavrao2000@gmail.com
        </p>

      </div>
    </main>
  );
}