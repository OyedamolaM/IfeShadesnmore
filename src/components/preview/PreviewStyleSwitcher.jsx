const PREVIEW_OPTIONS = [
  { id: "v1", label: "01", title: "Minimalist Gallery" },
  { id: "v2", label: "02", title: "Warm Earth" },
  { id: "v3", label: "03", title: "Solar Editorial" }
];

function PreviewStyleSwitcher({ value, onChange, title = "Preview style selector", compactLabel = "Theme" }) {
  return (
    <div className="preview-style-switcher" aria-label={title}>
      <span className="preview-switcher-label">{compactLabel}</span>
      <div className="preview-style-switcher-inner" role="tablist">
        {PREVIEW_OPTIONS.map((option) => {
          const isActive = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              className={isActive ? "is-active" : ""}
              onClick={() => onChange(option.id)}
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
