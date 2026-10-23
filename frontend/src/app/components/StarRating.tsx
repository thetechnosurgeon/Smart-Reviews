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
      style={{
        position: "relative",
        display: "inline-block",
        whiteSpace: "nowrap",
        lineHeight: 1,
        letterSpacing: 2,
        fontSize: size,
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.2)" }}>
        {"\u2605\u2605\u2605\u2605\u2605"}
      </span>
      <span
        data-fill={pct.toFixed(1)}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          overflow: "hidden",
          whiteSpace: "nowrap",
          width: `${pct}%`,
          color: "#d8a73a",
        }}
      >
        {"\u2605\u2605\u2605\u2605\u2605"}
      </span>
    </span>
  );
}
