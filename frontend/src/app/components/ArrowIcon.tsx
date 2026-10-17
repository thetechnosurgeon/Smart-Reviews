// The button arrow. Its hover / click animation lives in globals.css
// (.arrow-icon): on hover it tips up-right like the logo's growth arrow,
// and while the button is pressed it points straight up and squeezes.
export default function ArrowIcon({
  direction = "right",
  className = "",
}: {
  direction?: "left" | "right";
  className?: string;
}) {
  const left = direction === "left";

  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${left ? "arrow-icon-left" : "arrow-icon"} shrink-0 ${className}`}
    >
      {left ? (
        <>
          <path d="M19 12H5" />
          <path d="M11 6l-6 6 6 6" />
        </>
      ) : (
        <>
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </>
      )}
    </svg>
  );
}
