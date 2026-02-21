import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAdminBootstrapState, login, logout } from "../utils/api";

function AuthContainer({ title, subtitle, children }) {
  return (
    <div className="page auth-page">
      <div className="site-shell auth-shell">
        <article className="auth-card">
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
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAdmin, setHasAdmin] = useState(true);

  useEffect(() => {
    if (currentUser?.role === "admin") {
      navigate("/admin", { replace: true });
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
      navigate("/admin", { replace: true });
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
          <input
            type="password"
            value={state.password}
            onChange={(event) => setState((prev) => ({ ...prev, password: event.target.value }))}
            required
          />
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
