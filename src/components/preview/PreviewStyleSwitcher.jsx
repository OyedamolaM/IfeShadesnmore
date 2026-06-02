import { useState } from "react";

const PREVIEW_OPTIONS = [
  { id: "v1", label: "01", title: "Minimalist Gallery" },
  { id: "v2", label: "02", title: "Warm Earth" },
  { id: "v3", label: "03", title: "Solar Editorial" }
];

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
        <span aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
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
