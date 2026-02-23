function FrameArtwork({ variant = "round" }) {
  const normalizedVariant = String(variant || "round").trim().toLowerCase();
  const resolvedVariant =
    normalizedVariant === "cat-eye" || normalizedVariant === "cateye"
      ? "cat"
      : normalizedVariant === "butterfly"
        ? "butterfly"
        : normalizedVariant;

  const palette = {
    round: "#5d4235",
    cat: "#1f2124",
    tortoise: "#6a4b32",
    clear: "#d8d0c8",
    square: "#232427",
    aviator: "#222325",
    butterfly: "#5a3747"
  };

  const stroke = palette[resolvedVariant] ?? palette.round;

  return (
    <svg className="frame-art" viewBox="0 0 560 320" role="img" aria-label="Eyewear frame preview">
      <defs>
        <linearGradient id={`bg-${resolvedVariant}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f2ebe1" />
          <stop offset="100%" stopColor="#e6ddd2" />
        </linearGradient>
      </defs>
      <rect width="560" height="320" fill={`url(#bg-${resolvedVariant})`} />
      <g
        fill="none"
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={
          resolvedVariant === "cat" || resolvedVariant === "butterfly"
            ? "translate(0 -4)"
            : undefined
        }
      >
        {resolvedVariant === "cat" ? (
          <>
            <path d="M106 176c18-51 145-57 158 0c-16 27-145 27-158 0Z" />
            <path d="M296 176c16-55 140-55 158 0c-15 28-143 28-158 0Z" />
          </>
        ) : resolvedVariant === "butterfly" ? (
          <>
            <path d="M98 182c18-70 154-78 172-5c-15 42-156 45-172 5Z" />
            <path d="M290 177c18-73 154-62 172 3c-14 41-157 44-172-3Z" />
            <path d="M136 151c28-22 87-31 117-9" />
            <path d="M307 142c35-26 97-19 120 6" />
          </>
        ) : resolvedVariant === "aviator" ? (
          <>
            <path d="M108 170c9-51 132-58 152-5c-2 57-148 61-152 5Z" />
            <path d="M300 165c13-55 138-50 153 4c-4 56-148 58-153-4Z" />
          </>
        ) : (
          <>
            <ellipse
              cx="188"
              cy="170"
              rx={resolvedVariant === "round" ? 74 : resolvedVariant === "square" ? 86 : 88}
              ry={resolvedVariant === "round" ? 57 : resolvedVariant === "square" ? 54 : 50}
            />
            <ellipse
              cx="372"
              cy="170"
              rx={resolvedVariant === "round" ? 74 : resolvedVariant === "square" ? 86 : 88}
              ry={resolvedVariant === "round" ? 57 : resolvedVariant === "square" ? 54 : 50}
            />
          </>
        )}
        <path d="M262 168h36" />
        <path d="M98 170H65" />
        <path d="M462 170h33" />
      </g>
    </svg>
  );
}

export default FrameArtwork;
