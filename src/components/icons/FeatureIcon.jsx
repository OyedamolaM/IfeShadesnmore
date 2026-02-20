function FeatureIcon({ type }) {
  if (type === "shipping") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="8" width="12" height="8" rx="1.5" />
        <path d="M15 10h3l3 3v3h-6" />
        <circle cx="8" cy="18" r="1.8" />
        <circle cx="17.5" cy="18" r="1.8" />
      </svg>
    );
  }

  if (type === "arrivals") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2v6" />
        <path d="M12 16v6" />
        <path d="M3.5 12h6" />
        <path d="M14.5 12h6" />
        <circle cx="12" cy="12" r="4.25" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.2l2.5 2.6L16.5 9" />
    </svg>
  );
}

export default FeatureIcon;
