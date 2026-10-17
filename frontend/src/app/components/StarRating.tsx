// Gold stars filled in proportion to the rating, like the stars on a Google profile.
export default function StarRating({
  value,
  size = 28,
}: {
  value: number;
  size?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));

  return (
    <span
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
      className="relative inline-block whitespace-nowrap leading-none"
      style={{ fontSize: size }}
    >
      <span className="text-white/20">{"\u2605\u2605\u2605\u2605\u2605"}</span>
      <span
        data-fill={pct.toFixed(1)}
        className="absolute left-0 top-0 overflow-hidden whitespace-nowrap"
        style={{ width: `${pct}%`, color: "#FFD84D" }}
      >
        {"\u2605\u2605\u2605\u2605\u2605"}
      </span>
    </span>
  );
}
