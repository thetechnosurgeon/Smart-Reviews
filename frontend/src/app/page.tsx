import ReviewCard from "../components/ReviewCard";

export default function Home() {
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

        <p className="mt-12 text-sm text-black">
          drabhinavrao2000@gmail.com
        </p>

      </div>
    </main>
  );
}