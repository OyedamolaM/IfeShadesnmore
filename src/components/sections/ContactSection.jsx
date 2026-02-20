function SocialIcon({ type }) {
  if (type === "facebook") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13.4 8.1h2.3V5.2h-2.3c-2.3 0-3.7 1.6-3.7 3.8v2H7.5v2.8h2.2v5.1h2.9v-5.1h2.5l.4-2.8h-2.9V9.4c0-.8.4-1.3 1.1-1.3Z" />
      </svg>
    );
  }

  if (type === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="4.2" />
        <circle cx="12" cy="12" r="3.7" />
        <circle cx="17.2" cy="6.8" r="1.1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 7.5c-.5.2-1 .3-1.6.4a2.8 2.8 0 0 0 1.2-1.5c-.5.3-1.1.5-1.7.6a2.8 2.8 0 0 0-4.7 2.6a8 8 0 0 1-5.8-3A2.8 2.8 0 0 0 7.3 11c-.4 0-.8-.1-1.1-.3v.1a2.8 2.8 0 0 0 2.2 2.8c-.3.1-.6.1-.9.1h-.5A2.8 2.8 0 0 0 9.7 16a5.6 5.6 0 0 1-3.5 1.2H5a7.9 7.9 0 0 0 4.3 1.2c5.1 0 8-4.3 8-8V10a5.8 5.8 0 0 0 1.4-1.5Z" />
    </svg>
  );
}

function ContactSection({ email, emailStatus, onEmailChange, onSubscribe }) {
  return (
    <>
      <section className="subscribe-section" id="contact">
        <div className="container subscribe-inner">
          <h2>Stay Updated</h2>
          <form onSubmit={onSubscribe}>
            <input
              type="email"
              placeholder="Sign up for exclusive offers & updates"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
            />
            <button type="submit">Subscribe</button>
          </form>
        </div>
        {emailStatus ? <p className="subscribe-status">{emailStatus}</p> : null}
      </section>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-links">
            <a href="#privacy">Privacy Policy</a>
            <span>|</span>
            <a href="#terms">Terms of Service</a>
          </div>
          <div className="footer-socials" aria-label="Social media links">
            <a href="#facebook" aria-label="Facebook">
              <SocialIcon type="facebook" />
            </a>
            <a href="#instagram" aria-label="Instagram">
              <SocialIcon type="instagram" />
            </a>
            <a href="#twitter" aria-label="Twitter">
              <SocialIcon type="twitter" />
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}

export default ContactSection;
