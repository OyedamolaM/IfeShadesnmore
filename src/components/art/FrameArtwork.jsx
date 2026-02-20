function FrameArtwork({ variant = "round" }) {
  const palette = {
    round: "#5d4235",
    cat: "#1f2124",
    tortoise: "#6a4b32",
    clear: "#d8d0c8",
    square: "#232427",
    aviator: "#222325"
  };

  const stroke = palette[variant] ?? palette.round;

  return (
    <svg className="frame-art" viewBox="0 0 560 320" role="img" aria-label="Eyewear frame preview">
      <defs>
        <linearGradient id={`bg-${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f2ebe1" />
          <stop offset="100%" stopColor="#e6ddd2" />
        </linearGradient>
      </defs>
      <rect width="560" height="320" fill={`url(#bg-${variant})`} />
      <g
        fill="none"
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={variant === "cat" ? "translate(0 -4)" : undefined}
      >
        {variant === "cat" ? (
          <>
            <path d="M106 176c18-51 145-57 158 0c-16 27-145 27-158 0Z" />
            <path d="M296 176c16-55 140-55 158 0c-15 28-143 28-158 0Z" />
          </>
        ) : variant === "aviator" ? (
          <>
            <path d="M108 170c9-51 132-58 152-5c-2 57-148 61-152 5Z" />
            <path d="M300 165c13-55 138-50 153 4c-4 56-148 58-153-4Z" />
          </>
        ) : (
          <>
            <ellipse
              cx="188"
              cy="170"
              rx={variant === "round" ? 74 : variant === "square" ? 86 : 88}
              ry={variant === "round" ? 57 : variant === "square" ? 54 : 50}
            />
            <ellipse
              cx="372"
              cy="170"
              rx={variant === "round" ? 74 : variant === "square" ? 86 : 88}
              ry={variant === "round" ? 57 : variant === "square" ? 54 : 50}
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
