import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { verifyCheckout } from "../utils/api";

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

function PaymentCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("trxref") || "";
  const [state, setState] = useState({
    loading: true,
    error: "",
    message: "Verifying payment..."
  });

  useEffect(() => {
    if (!reference) {
      setState({
        loading: false,
        error: "Missing payment reference.",
        message: ""
      });
      return;
    }

    verifyCheckout(reference)
      .then((payload) => {
        const status = payload?.payment?.status;
        if (status === "paid") {
          setState({
            loading: false,
            error: "",
            message: `Payment confirmed for order ${payload.order?.id || ""}.`
          });
          return;
        }
        setState({
          loading: false,
          error: "Payment was not confirmed. Please contact support if you were charged.",
          message: ""
        });
      })
      .catch((requestError) => {
        setState({
          loading: false,
          error: requestError.message || "Could not verify payment.",
          message: ""
        });
      });
  }, [reference]);

  return (
    <AuthContainer title="Payment Status" subtitle="">
      {state.loading ? <p>{state.message}</p> : null}
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {!state.loading && !state.error ? <p className="form-success">{state.message}</p> : null}
      <div className="auth-inline-actions">
        <button type="button" className="secondary-action" onClick={() => navigate("/account")}>
          View Orders
        </button>
        <button type="button" className="primary-action" onClick={() => navigate("/")}>
          Back to Shop
        </button>
      </div>
    </AuthContainer>
  );
}

export default PaymentCallbackPage;
