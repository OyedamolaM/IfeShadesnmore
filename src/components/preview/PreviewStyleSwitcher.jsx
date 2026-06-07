import { useState } from "react";

const PREVIEW_OPTIONS = [
  { id: "v1", label: "01", title: "Gallery" },
  { id: "v2", label: "02", title: "Terra" },
  { id: "v3", label: "03", title: "Solar" }
];

function ThemeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 9 9c0-.6-.49-1-1.09-1h-1.56a2.1 2.1 0 0 1-2.1-2.1V7.34A4.34 4.34 0 0 0 11.91 3H12Z" />
      <path d="M7.5 11.5h.01" />
      <path d="M9.5 7.8h.01" />
      <path d="M13.8 6.8h.01" />
    </svg>
  );
}

function PreviewStyleSwitcher({ value, onChange, title = "Preview style selector", compactLabel = "Theme" }) {
  const [isOpen, setIsOpen] = useState(false);
  const activeOption = PREVIEW_OPTIONS.find((option) => option.id === value) || PREVIEW_OPTIONS[0];

  return (
    <div className={`preview-style-switcher ${isOpen ? "is-open" : ""}`} aria-label={title}>
      <button
        type="button"
        className="preview-theme-toggle"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-label={`${compactLabel}: ${activeOption.title}`}
        title={`${compactLabel}: ${activeOption.title}`}
      >
        <ThemeIcon />
      </button>
      <div className="preview-style-switcher-inner" role="tablist" aria-hidden={!isOpen}>
        {PREVIEW_OPTIONS.map((option) => {
          const isActive = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              className={isActive ? "is-active" : ""}
              onClick={() => {
                onChange(option.id);
                setIsOpen(false);
              }}
              role="tab"
              aria-selected={isActive}
              title={option.title}
            >
              <span>{option.label}</span>
              <strong>{option.title}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PreviewStyleSwitcher;
