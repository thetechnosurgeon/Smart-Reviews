"use client";
import { useState } from "react";
export default function ReviewCard(props: {review: string}) {
    const [reply, setReply] = useState("");
  return (
    <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-yellow-300">★★★★★</h2>

      <p className="mt-4 leading-7 text-slate-800">
        {props.review}
      </p>

      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <h3 className="font-semibold text-blue-950">AI Suggestion</h3>

        <p className="mt-2 leading-7 text-slate-700">
        { reply || "No AI reply yet." }
        </p>
      </div>

      <div className="mt-6 flex gap-3">
        <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">
          Edit
        </button>

        <button
        
  className="rounded-lg bg-blue-600 px-4 py-2 text-white"
  onClick={() =>
    setReply(
      "Thank you for your kind words. We truly appreciate your feedback!"
    )
}>
      Generate reply

  
</button>
      </div>
    </div>
  );
}