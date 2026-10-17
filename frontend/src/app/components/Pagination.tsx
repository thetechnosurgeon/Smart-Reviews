import ArrowIcon from "./ArrowIcon";
import { pageRange } from "../lib/pagination";

export default function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPrev,
  onNext,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
}) {
  const { start, end } = pageRange(total, page, pageSize);

  return (
    <nav
      aria-label="Review pages"
      className="flex flex-wrap items-center justify-between gap-3 py-4"
    >
      <p className="text-sm text-[#5A6B86]">
        {total === 0
          ? "No reviews to show"
          : `Showing ${start}\u2013${end} of ${total}`}
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={onPrev}
          disabled={disabled || page <= 1}
          className="inline-flex items-center gap-2 rounded-lg border border-[#1957C9]/30 bg-white px-4 py-2 text-sm font-semibold text-[#1957C9] transition hover:bg-[#1957C9]/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowIcon direction="left" />
          Previous
        </button>

        <span className="min-w-24 text-center text-sm font-medium text-[#0B0C10]">
          Page {page} of {totalPages}
        </span>

        <button
          onClick={onNext}
          disabled={disabled || page >= totalPages}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1957C9] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B3A8C] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ArrowIcon />
        </button>
      </div>
    </nav>
  );
}
