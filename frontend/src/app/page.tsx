import ReviewCard from "../components/ReviewCard";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 p-10 text-slate-900">
      <h1 className="mb-8 text-4xl font-bold tracking-tight">
        🤖 AI Review Copilot
      </h1>

      <ReviewCard review=" Ramesh was very kind"/>
      <ReviewCard review="Dr. Rao was amazing" />
      <ReviewCard review="Wow" />
    </main>
  );
}