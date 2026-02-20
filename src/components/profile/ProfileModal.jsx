function ProfileModal({
  open,
  onClose,
  profileDraft,
  onFieldChange,
  onSave
}) {
  if (!open) return null;

  return (
    <div className="commerce-overlay profile-overlay" onClick={onClose}>
      <div
        className="profile-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Customer profile"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="checkout-header">
          <h2>My Profile</h2>
          <button type="button" className="close-x" onClick={onClose} aria-label="Close profile">
            x
          </button>
        </div>

        <form className="profile-form" onSubmit={onSave}>
          <label>
            Full name
            <input
              value={profileDraft.fullName}
              onChange={(event) => onFieldChange("fullName", event.target.value)}
              placeholder="Your full name"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={profileDraft.email}
              onChange={(event) => onFieldChange("email", event.target.value)}
              placeholder="you@email.com"
            />
          </label>
          <label>
            Phone number
            <input
              value={profileDraft.phone}
              onChange={(event) => onFieldChange("phone", event.target.value)}
              placeholder="+234..."
            />
          </label>
          <label>
            Address
            <input
              value={profileDraft.address}
              onChange={(event) => onFieldChange("address", event.target.value)}
              placeholder="Street and area"
            />
          </label>
          <label>
            City
            <input
              value={profileDraft.city}
              onChange={(event) => onFieldChange("city", event.target.value)}
              placeholder="City"
            />
          </label>

          <button type="submit" className="primary-action">
            Save Profile
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProfileModal;
