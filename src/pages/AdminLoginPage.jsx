import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import PasswordVisibilityIcon from "../components/icons/PasswordVisibilityIcon";
import { fetchAdminBootstrapState, login, logout } from "../utils/api";
import { getStoredThemeVariant } from "../utils/themePreference";

function AuthContainer({ title, subtitle, children, onBack }) {
  const [themeVariant, setThemeVariant] = useState(() => getStoredThemeVariant());

  useEffect(() => {
    setThemeVariant(getStoredThemeVariant());
  }, []);

  return (
    <div className={`page auth-page auth-theme-${themeVariant}`}>
      <div className="site-shell auth-shell auth-shell-login">
        <article className="auth-card">
          <button type="button" className="auth-back-link" onClick={onBack}>
            Back to store
          </button>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
          {children}
        </article>
      </div>
    </div>
  );
}

function AdminLoginPage({ currentUser, onAuthenticated }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAdmin, setHasAdmin] = useState(true);

  useEffect(() => {
    if (currentUser?.role === "admin") {
      navigate({ to: "/admin", replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    fetchAdminBootstrapState()
      .then((payload) => setHasAdmin(Boolean(payload.hasAdmin)))
      .catch(() => setHasAdmin(true));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const payload = await login({
        email: state.email.trim(),
        password: state.password
      });
      if (payload.user?.role !== "admin") {
        await logout();
        setError("This account is not an admin account.");
        return;
      }
      onAuthenticated(payload.user);
      navigate({ to: "/admin", replace: true });
    } catch (requestError) {
      setError(requestError.message || "Admin login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthContainer
      title="Admin Login"
      subtitle="Sign in with an admin account to manage orders, customers, products, and settings."
      onBack={() => navigate({ to: "/" })}
    >
      {!hasAdmin ? (
        <p className="form-error">
          No admin account detected. Set <code>ADMIN_EMAIL</code> and <code>ADMIN_PASSWORD</code> on
          the server and restart.
        </p>
      ) : null}
      <form className="auth-form" onSubmit={submit}>
        <label>
          Admin Email
          <input
            type="email"
            value={state.email}
            onChange={(event) => setState((prev) => ({ ...prev, email: event.target.value }))}
            required
          />
        </label>
        <label>
          Password
          <div className="auth-password-field">
            <input
              type={showPassword ? "text" : "password"}
              value={state.password}
              onChange={(event) => setState((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              <PasswordVisibilityIcon visible={showPassword} />
            </button>
          </div>
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="primary-action" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Login to Admin"}
        </button>
      </form>
    </AuthContainer>
  );
}

export default AdminLoginPage;
