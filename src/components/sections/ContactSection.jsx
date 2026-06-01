import { Link } from "@tanstack/react-router";

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

  if (type === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.8 3.5c.6 1.6 1.8 2.8 3.4 3.4v2.6a6.1 6.1 0 0 1-3.4-1v5.6a5.8 5.8 0 1 1-5-5.8v2.7a3.2 3.2 0 1 0 2.4 3.1V3.5h2.6Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 7.5c-.5.2-1 .3-1.6.4a2.8 2.8 0 0 0 1.2-1.5c-.5.3-1.1.5-1.7.6a2.8 2.8 0 0 0-4.7 2.6a8 8 0 0 1-5.8-3A2.8 2.8 0 0 0 7.3 11c-.4 0-.8-.1-1.1-.3v.1a2.8 2.8 0 0 0 2.2 2.8c-.3.1-.6.1-.9.1h-.5A2.8 2.8 0 0 0 9.7 16a5.6 5.6 0 0 1-3.5 1.2H5a7.9 7.9 0 0 0 4.3 1.2c5.1 0 8-4.3 8-8V10a5.8 5.8 0 0 0 1.4-1.5Z" />
    </svg>
  );
}

function ContactSection({ email, emailStatus, onEmailChange, onSubscribe, isSubscribing = false }) {
  const emailAddress = "oluborodedeborah2000@gmail.com";
  const phoneNumber = "09063556765";
  const officeAddress = "1, Sunday Akinbo Str, command Ipaja, Lagos";
  const whatsappLink =
    "https://wa.me/2349063556765?text=Hello%20Ife_ShadesnMore%2C%20I%20would%20like%20to%20make%20an%20order.";
  const savansWhatsAppLink =
    "https://wa.me/2348165258326?text=Hello%20Savans%20Technologies%2C%20I%20need%20a%20website.";

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
              disabled={isSubscribing}
            />
            <button type="submit" disabled={isSubscribing}>
              {isSubscribing ? "Subscribing..." : "Subscribe"}
            </button>
          </form>
        </div>
        {emailStatus ? <p className="subscribe-status">{emailStatus}</p> : null}
      </section>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-links">
            <Link to="/privacy-policy" className="footer-link-button">
              Privacy Policy
            </Link>
            <span>|</span>
            <Link to="/terms-of-service" className="footer-link-button">
              Terms of Service
            </Link>
          </div>

          <div className="footer-contact-stack">
            <div className="footer-contact-links">
              <a href={`mailto:${emailAddress}`}
              target="_blank"
              rel="noopener noreferrer">{emailAddress}</a>
              <span>|</span>
              <a href={`tel:${phoneNumber}`}>{phoneNumber}</a>
              <span>|</span>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </div>
            <p>{officeAddress}</p>
            <p className="footer-credit">
              Powered by{" "}
              <a
                className="footer-credit-link"
                href={savansWhatsAppLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Savans Technologies
              </a>
            </p>
          </div>

          <div className="footer-socials" aria-label="Social media links">
            <a
              href="https://www.facebook.com/share/1CJYVRj8hQ/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <SocialIcon type="facebook" />
            </a>
            <a
              href="https://www.instagram.com/ife_shadesnmore?igsh=MW90cDlmdXRzZzRncQ=="
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <SocialIcon type="instagram" />
            </a>
            <a
              href="https://www.tiktok.com/@ife_shadesnmore?_r=1&_t=ZS-946goatDDNp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
            >
              <SocialIcon type="tiktok" />
            </a>
          </div>
        </div>
      </footer>

    </>
  );
}

export default ContactSection;
