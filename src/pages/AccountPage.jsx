import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMyOrders, logout, updatePassword, updateProfile } from "../utils/api";

function AccountPage({ currentUser, onLoggedOut, onUserUpdated }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isOrderHistoryModalOpen, setIsOrderHistoryModalOpen] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [profileDraft, setProfileDraft] = useState({
    fullName: currentUser?.fullName || "",
    phone: currentUser?.phone || "",
    address: currentUser?.address || "",
    city: currentUser?.city || ""
  });
  const firstName = String(currentUser?.fullName || "").trim().split(/\s+/)[0] || "there";

  useEffect(() => {
    setProfileDraft({
      fullName: currentUser?.fullName || "",
      phone: currentUser?.phone || "",
      address: currentUser?.address || "",
      city: currentUser?.city || ""
    });
  }, [currentUser]);

  useEffect(() => {
    fetchMyOrders()
      .then((payload) => setOrders(Array.isArray(payload.orders) ? payload.orders : []))
      .catch((requestError) => setOrdersError(requestError.message || "Could not fetch orders."));
  }, []);

  useEffect(() => {
    if (!isProfileModalOpen) return undefined;
    const handleEscClose = (event) => {
      if (event.key !== "Escape") return;
      if (isSaving) return;
      setIsProfileModalOpen(false);
      setProfileError("");
    };

    window.addEventListener("keydown", handleEscClose);
    return () => window.removeEventListener("keydown", handleEscClose);
  }, [isProfileModalOpen, isSaving]);

  useEffect(() => {
    if (!isPasswordModalOpen) return undefined;
    const handleEscClose = (event) => {
      if (event.key !== "Escape") return;
      if (isChangingPassword) return;
      setIsPasswordModalOpen(false);
      setPasswordError("");
      setPasswordDraft({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    };

    window.addEventListener("keydown", handleEscClose);
    return () => window.removeEventListener("keydown", handleEscClose);
  }, [isChangingPassword, isPasswordModalOpen]);

  useEffect(() => {
    if (!isOrderHistoryModalOpen) return undefined;
    const handleEscClose = (event) => {
      if (event.key !== "Escape") return;
      setIsOrderHistoryModalOpen(false);
    };

    window.addEventListener("keydown", handleEscClose);
    return () => window.removeEventListener("keydown", handleEscClose);
  }, [isOrderHistoryModalOpen]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileError("");
    setProfileNotice("");
    setIsSaving(true);
    try {
      const payload = await updateProfile(profileDraft);
      onUserUpdated(payload.user);
      setProfileNotice("Profile updated.");
      setIsProfileModalOpen(false);
    } catch (requestError) {
      setProfileError(requestError.message || "Could not update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const signOut = async () => {
    await logout().catch(() => {});
    onLoggedOut();
    navigate("/", { replace: true });
  };

  const openProfileModal = () => {
    setProfileError("");
    setIsProfileModalOpen(true);
  };

  const closeProfileModal = () => {
    if (isSaving) return;
    setIsProfileModalOpen(false);
    setProfileError("");
  };

  const openPasswordModal = () => {
    setPasswordError("");
    setIsProfileModalOpen(false);
    setIsPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    if (isChangingPassword) return;
    setIsPasswordModalOpen(false);
    setPasswordError("");
    setPasswordDraft({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
  };

  const openOrderHistoryModal = () => {
    setIsOrderHistoryModalOpen(true);
  };

  const closeOrderHistoryModal = () => {
    setIsOrderHistoryModalOpen(false);
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordNotice("");

    if (!passwordDraft.currentPassword || !passwordDraft.newPassword) {
      setPasswordError("Current and new password are required.");
      return;
    }

    if (passwordDraft.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const payload = await updatePassword({
        currentPassword: passwordDraft.currentPassword,
        newPassword: passwordDraft.newPassword
      });
      setPasswordNotice(payload?.message || "Password updated successfully.");
      setIsPasswordModalOpen(false);
      setPasswordDraft({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    } catch (requestError) {
      setPasswordError(requestError.message || "Could not update password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const latestOrder = orders[0] || null;
  const hasOrderHistory = orders.length > 1;

  const renderOrderCard = (order, keyPrefix = "order") => (
    <article className="order-item" key={`${keyPrefix}-${order.id}`}>
      <header>
        <strong>{order.id}</strong>
        <div className="order-badges">
          <span className={`order-status status-${order.paymentStatus}`}>Payment: {order.paymentStatus}</span>
          <span className={`order-status status-order-${order.orderStatus || "pending"}`}>
            Order: {order.orderStatus || "pending"}
          </span>
        </div>
      </header>
      <p>
        {new Date(order.createdAt).toLocaleString()} | NGN {Number(order.subtotal).toLocaleString()}
      </p>
      <ul>
        {(order.items || []).map((item) => (
          <li key={`${order.id}-${item.id || item.productId}`}>
            {item.name} x {item.quantity}
          </li>
        ))}
      </ul>
    </article>
  );

  return (
    <div className="page auth-page">
      <div className="site-shell account-shell">
        <div className="account-header">
          <div className="account-heading">
            <h1>My Account</h1>
            <p className="account-greeting">Hello, {firstName}</p>
          </div>
          <div className="account-actions">
            <button
              type="button"
              className="account-action-button account-action-profile"
              onClick={openProfileModal}
            >
              Profile
            </button>
            <button
              type="button"
              className="account-action-button account-action-shop"
              onClick={() => navigate("/")}
            >
              Back to Shop
            </button>
            <button type="button" className="account-action-button account-action-logout" onClick={signOut}>
              Logout
            </button>
          </div>
        </div>

        <div className="account-grid">
          <section className="account-card orders-card account-orders-wide">
            <h2>Recent Order</h2>
            {profileNotice ? <p className="form-success">{profileNotice}</p> : null}
            {passwordNotice ? <p className="form-success">{passwordNotice}</p> : null}
            {ordersError ? <p className="form-error">{ordersError}</p> : null}
            {!latestOrder ? <p>No orders yet.</p> : renderOrderCard(latestOrder, "recent")}
            {hasOrderHistory ? (
              <button type="button" className="order-history-link" onClick={openOrderHistoryModal}>
                View Order History
              </button>
            ) : null}
          </section>
        </div>
      </div>

      {isOrderHistoryModalOpen ? (
        <div className="commerce-overlay account-order-history-overlay" onClick={closeOrderHistoryModal}>
          <section
            className="profile-modal account-order-history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-order-history-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="close-x" onClick={closeOrderHistoryModal}>
              x
            </button>
            <div className="profile-form account-order-history-content">
              <h2 id="account-order-history-title">Order History</h2>
              <p className="account-order-history-count">Showing {orders.length} orders</p>
              <div className="account-order-history-list">
                {orders.map((order) => renderOrderCard(order, "history"))}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isProfileModalOpen ? (
        <div className="commerce-overlay account-profile-overlay" onClick={closeProfileModal}>
          <section
            className="profile-modal account-profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-profile-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="close-x" onClick={closeProfileModal} disabled={isSaving}>
              x
            </button>
            <form className="profile-form account-profile-form" onSubmit={saveProfile}>
              <h2 id="account-profile-title">My Profile</h2>
              <p className="account-email">{currentUser?.email}</p>
              <label>
                Full name
                <input
                  value={profileDraft.fullName}
                  onChange={(event) =>
                    setProfileDraft((current) => ({ ...current, fullName: event.target.value }))
                  }
                  required
                  autoFocus
                />
              </label>
              <label>
                Phone
                <input
                  value={profileDraft.phone}
                  onChange={(event) =>
                    setProfileDraft((current) => ({ ...current, phone: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Address
                <input
                  value={profileDraft.address}
                  onChange={(event) =>
                    setProfileDraft((current) => ({ ...current, address: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                City
                <input
                  value={profileDraft.city}
                  onChange={(event) =>
                    setProfileDraft((current) => ({ ...current, city: event.target.value }))
                  }
                  required
                />
              </label>
              {profileError ? <p className="form-error">{profileError}</p> : null}
              <div className="account-profile-actions">
                <button type="button" className="secondary-action" onClick={openPasswordModal}>
                  Change Password
                </button>
                <button type="submit" className="primary-action" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isPasswordModalOpen ? (
        <div className="commerce-overlay account-password-overlay" onClick={closePasswordModal}>
          <section
            className="profile-modal account-password-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-password-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="close-x" onClick={closePasswordModal} disabled={isChangingPassword}>
              x
            </button>
            <form className="profile-form account-password-form" onSubmit={changePassword}>
              <h2 id="account-password-title">Change Password</h2>
              <label>
                Current password
                <input
                  type="password"
                  value={passwordDraft.currentPassword}
                  onChange={(event) =>
                    setPasswordDraft((current) => ({ ...current, currentPassword: event.target.value }))
                  }
                  autoFocus
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  value={passwordDraft.newPassword}
                  onChange={(event) =>
                    setPasswordDraft((current) => ({ ...current, newPassword: event.target.value }))
                  }
                  minLength={8}
                />
              </label>
              <label>
                Confirm new password
                <input
                  type="password"
                  value={passwordDraft.confirmPassword}
                  onChange={(event) =>
                    setPasswordDraft((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                  minLength={8}
                />
              </label>
              {passwordError ? <p className="form-error">{passwordError}</p> : null}
              <div className="account-password-actions">
                <button
                  type="button"
                  className="secondary-action account-password-cancel"
                  onClick={closePasswordModal}
                  disabled={isChangingPassword}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-action" disabled={isChangingPassword}>
                  {isChangingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default AccountPage;
