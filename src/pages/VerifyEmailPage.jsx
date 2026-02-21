import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { verifyEmailToken } from "../utils/api";

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

function VerifyEmailPage({ onVerified }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = String(searchParams.get("token") || "").trim();
  const [state, setState] = useState({
    loading: true,
    error: "",
    message: ""
  });

  useEffect(() => {
    if (!token) {
      setState({
        loading: false,
        error: "Verification token is missing.",
        message: ""
      });
      return;
    }

    verifyEmailToken(token)
      .then((payload) => {
        if (payload?.user) onVerified(payload.user);
        setState({
          loading: false,
          error: "",
          message: payload?.message || "Email verified successfully."
        });
      })
      .catch((requestError) => {
        setState({
          loading: false,
          error: requestError.message || "Could not verify email.",
          message: ""
        });
      });
  }, [token, onVerified]);

  return (
    <AuthContainer title="Email Verification" subtitle="">
      {state.loading ? <p>Verifying your email...</p> : null}
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.message ? <p className="form-success">{state.message}</p> : null}
      <div className="auth-inline-actions">
        <button type="button" className="secondary-action" onClick={() => navigate("/account/login")}>
          Go to Login
        </button>
        <button type="button" className="primary-action" onClick={() => navigate("/account")}>
          Go to Account
        </button>
      </div>
    </AuthContainer>
  );
}

export default VerifyEmailPage;

