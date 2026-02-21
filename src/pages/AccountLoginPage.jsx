import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login, register, resendVerificationEmail } from "../utils/api";

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

function AccountLoginPage({ currentUser, onAuthenticated }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/account";
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    city: ""
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  useEffect(() => {
    if (currentUser) {
      navigate(currentUser.role === "admin" ? "/admin" : redirect, { replace: true });
    }
  }, [currentUser, navigate, redirect]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setPendingVerificationEmail("");
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        const payload = await login({
          email: form.email.trim(),
          password: form.password
        });
        onAuthenticated(payload.user);
        setNotice("Login successful.");
        navigate(payload.user?.role === "admin" ? "/admin" : redirect, { replace: true });
      } else {
        const payload = await register({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city.trim()
        });

        const fallbackLink =
          payload?.verificationUrl ? ` Verification link: ${payload.verificationUrl}` : "";
        setNotice(
          (payload?.message || "Account created. Please verify your email before logging in.") +
            fallbackLink
        );
        setPendingVerificationEmail(form.email.trim());
        setMode("login");
      }
    } catch (requestError) {
      if (requestError?.details?.requiresEmailVerification) {
        setPendingVerificationEmail(requestError.details.email || form.email.trim());
        setNotice(requestError.message || "Please verify your email before logging in.");
        setError("");
        return;
      }
      setError(requestError.message || "Could not authenticate.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingVerificationEmail) return;
    setIsResendingVerification(true);
    setError("");
    try {
      const payload = await resendVerificationEmail(pendingVerificationEmail);
      const fallbackLink =
        payload?.verificationUrl ? ` Verification link: ${payload.verificationUrl}` : "";
      setNotice((payload?.message || "Verification email sent.") + fallbackLink);
    } catch (requestError) {
      setError(requestError.message || "Could not resend verification email.");
    } finally {
      setIsResendingVerification(false);
    }
  };

  return (
    <AuthContainer
      title={mode === "login" ? "Customer Login" : "Create Customer Account"}
      subtitle="Login to view orders and complete secure checkout. New accounts must verify email."
    >
      <div className="auth-mode-switch">
        <button
          type="button"
          className={mode === "login" ? "is-active" : ""}
          onClick={() => {
            setMode("login");
            setError("");
            setNotice("");
            setPendingVerificationEmail("");
          }}
        >
          Login
        </button>
        <button
          type="button"
          className={mode === "register" ? "is-active" : ""}
          onClick={() => {
            setMode("register");
            setError("");
            setNotice("");
            setPendingVerificationEmail("");
          }}
        >
          Register
        </button>
      </div>

      <form className="auth-form" onSubmit={submit}>
        {mode === "register" ? (
          <label>
            Full name
            <input
              value={form.fullName}
              onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
              required
            />
          </label>
        ) : null}
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            required
            minLength={8}
          />
        </label>
        {mode === "register" ? (
          <>
            <label>
              Phone
              <input
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </label>
            <label>
              Address
              <input
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
              />
            </label>
            <label>
              City
              <input
                value={form.city}
                onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
              />
            </label>
          </>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="form-success">{notice}</p> : null}
        {mode === "login" && pendingVerificationEmail ? (
          <button
            type="button"
            className="secondary-action"
            onClick={handleResendVerification}
            disabled={isResendingVerification}
          >
            {isResendingVerification ? "Sending..." : "Resend Verification Email"}
          </button>
        ) : null}
        <button type="submit" className="primary-action" disabled={isSubmitting}>
          {isSubmitting ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
        </button>
      </form>
    </AuthContainer>
  );
}

export default AccountLoginPage;
