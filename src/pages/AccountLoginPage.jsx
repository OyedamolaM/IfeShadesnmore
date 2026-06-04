import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import PasswordVisibilityIcon from "../components/icons/PasswordVisibilityIcon";
import { login, loginWithGoogle, register, resendVerificationEmail } from "../utils/api";
import { getStoredThemeVariant } from "../utils/themePreference";

const GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
const GOOGLE_IDENTITY_SCRIPT_ID = "google-identity-services";

function AuthContainer({ title, subtitle, children, shellClassName = "", onBack }) {
  const shellClass = ["site-shell", "auth-shell", shellClassName].filter(Boolean).join(" ");
  const [themeVariant, setThemeVariant] = useState(() => getStoredThemeVariant());

  useEffect(() => {
    setThemeVariant(getStoredThemeVariant());
  }, []);

  return (
    <div className={`page auth-page auth-theme-${themeVariant}`}>
      <div className={shellClass}>
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

function AccountLoginPage({ currentUser, onAuthenticated }) {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.searchStr || "");
  const redirectParam = String(searchParams.get("redirect") || "").trim();
  const redirect = redirectParam.startsWith("/") ? redirectParam : "/";
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: ""
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const googleButtonRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      navigate({ to: currentUser.role === "admin" ? "/admin" : redirect, replace: true });
    }
  }, [currentUser, navigate, redirect]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return undefined;

    let isCancelled = false;

    const handleGoogleCredential = async (response) => {
      if (!response?.credential) {
        setError("Google did not return a login credential.");
        return;
      }

      setError("");
      setNotice("");
      setPendingVerificationEmail("");
      setIsGoogleSubmitting(true);
      try {
        const payload = await loginWithGoogle(response.credential);
        onAuthenticated(payload.user);
        setNotice("Google login successful. Redirecting...");
        navigate({ to: payload.user?.role === "admin" ? "/admin" : redirect, replace: true });
      } catch (requestError) {
        setError(requestError.message || "Google login failed. Please try again.");
      } finally {
        setIsGoogleSubmitting(false);
      }
    };

    const renderGoogleButton = () => {
      if (isCancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential
      });
      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        type: "standard",
        shape: "pill",
        text: "continue_with",
        width: 320
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      let script = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID);
      if (!script) {
        script = document.createElement("script");
        script.id = GOOGLE_IDENTITY_SCRIPT_ID;
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderGoogleButton);
      return () => {
        isCancelled = true;
        script.removeEventListener("load", renderGoogleButton);
      };
    }

    return () => {
      isCancelled = true;
    };
  }, [navigate, onAuthenticated, redirect]);

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
        navigate({ to: payload.user?.role === "admin" ? "/admin" : redirect, replace: true });
      } else {
        if (!form.firstName.trim() || !form.lastName.trim()) {
          setError("First name and last name are required.");
          return;
        }
        if (!form.phone.trim()) {
          setError("Phone number is required.");
          return;
        }

        const payload = await register({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim()
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
      onBack={() => navigate({ to: "/" })}
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

      {GOOGLE_CLIENT_ID ? (
        <div className="auth-google-panel">
          <div ref={googleButtonRef} className="auth-google-button" aria-label="Continue with Google" />
          {isGoogleSubmitting ? <p className="auth-google-status">Signing in with Google...</p> : null}
          <span>or continue with email</span>
        </div>
      ) : null}

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
              <PasswordVisibilityIcon visible={showPassword} />
            </button>
          </div>
        </label>
        {mode === "register" ? (
          <label>
            <span>
              Phone <span className="required-mark">*</span>
            </span>
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              required
            />
          </label>
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
