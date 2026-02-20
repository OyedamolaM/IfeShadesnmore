function FeatureIcon({ type }) {
  if (type === "quality") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l6.8 2.2v5.6c0 4.5-2.7 7.9-6.8 9.8c-4.1-1.9-6.8-5.3-6.8-9.8V5.2L12 3Z" />
        <circle cx="12" cy="11.6" r="3.2" />
        <path d="M10.5 11.6l1.2 1.2l2.3-2.3" />
      </svg>
    );
  }

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

  if (type === "returns") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l6.8 2.2v5.6c0 4.5-2.7 7.9-6.8 9.8c-4.1-1.9-6.8-5.3-6.8-9.8V5.2L12 3Z" />
        <path d="M15.6 10.6A3.8 3.8 0 1 0 12 15.4" />
        <path d="M12 7.8v2.8l2 1.2" />
        <path d="M16.2 14.6l-.9 2.1l2.2-.4" />
      </svg>
    );
  }

  if (type === "arrivals") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="2.4" />
        <path d="M12 3.2v3.4" />
        <path d="M12 17.4v3.4" />
        <path d="M3.2 12h3.4" />
        <path d="M17.4 12h3.4" />
        <path d="M5.8 5.8l2.4 2.4" />
        <path d="M15.8 15.8l2.4 2.4" />
        <path d="M18.2 5.8l-2.4 2.4" />
        <path d="M8.2 15.8l-2.4 2.4" />
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
