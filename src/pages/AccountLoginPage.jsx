import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login, register, resendVerificationEmail } from "../utils/api";

function AuthContainer({ title, subtitle, children, shellClassName = "" }) {
  const shellClass = ["site-shell", "auth-shell", shellClassName].filter(Boolean).join(" ");
  return (
    <div className="page auth-page">
      <div className={shellClass}>
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
  const redirectParam = String(searchParams.get("redirect") || "").trim();
  const redirect = redirectParam.startsWith("/") ? redirectParam : "/";
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
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
  const [showPassword, setShowPassword] = useState(false);

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
        setNotice("Login successful. Redirecting...");
        navigate(payload.user?.role === "admin" ? "/admin" : redirect, { replace: true });
      } else {
        if (!form.firstName.trim() || !form.lastName.trim()) {
          setError("First name and last name are required.");
          return;
        }

        const payload = await register({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city.trim()
        });

        setNotice(payload?.message || "Signup successful. Please verify your email, then login.");
        setPendingVerificationEmail(form.email.trim());
        setMode("login");
      }
    } catch (requestError) {
      if (requestError?.details?.requiresEmailVerification) {
        setPendingVerificationEmail(requestError.details.email || form.email.trim());
        setNotice(
          mode === "login"
            ? requestError.message ||
                "Login blocked: your email is not verified yet. Check your inbox or resend verification."
            : requestError.message || "Signup complete. Please verify your email before login."
        );
        setError("");
        return;
      }
      setError(
        mode === "login"
          ? requestError.message || "Login failed. Check your email and password."
          : requestError.message || "Signup failed. Please check your details and try again."
      );
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
      setNotice(payload?.message || "Verification email sent. Please check your inbox and spam folder.");
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
      shellClassName={mode === "login" ? "auth-shell-login" : ""}
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
          <div className="split-input-row">
            <label>
              <span>
                First name <span className="required-mark">*</span>
              </span>
              <input
                value={form.firstName}
                onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
                required
              />
            </label>
            <label>
              <span>
                Last name <span className="required-mark">*</span>
              </span>
              <input
                value={form.lastName}
                onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
                required
              />
            </label>
          </div>
        ) : null}
        <label>
          <span>
            Email <span className="required-mark">*</span>
          </span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            required
          />
        </label>
        <label>
          <span>
            Password <span className="required-mark">*</span>
          </span>
          <div className="auth-password-field">
            <input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              required
              minLength={8}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
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
