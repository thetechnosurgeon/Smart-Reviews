"use client";
import { useState } from "react";
export default function ReviewCard(props: {review: string}) {
    const [reply, setReply] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    
async function handleGenerateReply() {
     setIsLoading(true);
    const response = await fetch(
        "http://127.0.0.1:8000/generate-reply",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                review: props.review,
            }),
        }
    );

    console.log(response.status);

    const data = await response.json();
    console.log(data);

    setReply(data.reply);
    setIsLoading(false);
}
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
           onClick={handleGenerateReply}
           disabled={isLoading}
           className={`rounded-lg px-4 py-2 text-white ${
  isLoading ? "bg-blue-200" : "bg-blue-600"
}`}
  >
          {isLoading ? "Generating..." : "Generate reply"}
  
</button>
      </div>
    </div>
  );
}