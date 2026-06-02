function PasswordVisibilityIcon({ visible = false }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      focusable="false"
      className="password-visibility-icon"
    >
      {visible ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 5.2A9.9 9.9 0 0 1 12 5c5 0 8.5 4.2 9.6 5.8a2 2 0 0 1 0 2.4 16.3 16.3 0 0 1-2.2 2.6" />
          <path d="M6.4 6.5a16.1 16.1 0 0 0-4 4.3 2 2 0 0 0 0 2.4C3.5 14.8 7 19 12 19a9.8 9.8 0 0 0 4.2-.9" />
        </>
      ) : (
        <>
          <path d="M2.4 10.8C3.5 9.2 7 5 12 5s8.5 4.2 9.6 5.8a2 2 0 0 1 0 2.4C20.5 14.8 17 19 12 19s-8.5-4.2-9.6-5.8a2 2 0 0 1 0-2.4Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export default PasswordVisibilityIcon;
