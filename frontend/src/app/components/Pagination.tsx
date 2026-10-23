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
    <nav aria-label="Review pages" className="pager">
      <span>
        {total === 0
          ? "No reviews to show"
          : `Showing ${start}\u2013${end} of ${total}`}
      </span>

      <div className="pager-nav">
        <button
          className="btn btn--ghost btn--sm"
          onClick={onPrev}
          disabled={disabled || page <= 1}
        >
          <ArrowIcon direction="left" />
          Previous
        </button>

        <span className="pg">
          Page {page} of {totalPages}
        </span>

        <button
          className="btn btn--ink btn--sm"
          onClick={onNext}
          disabled={disabled || page >= totalPages}
        >
          Next
          <ArrowIcon />
        </button>
      </div>
    </nav>
  );
}
