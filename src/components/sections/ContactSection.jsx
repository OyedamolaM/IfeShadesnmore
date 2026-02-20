function ContactSection({ email, emailStatus, onEmailChange, onSubscribe }) {
  return (
    <section className="contact-section" id="contact">
      <div className="container contact-grid">
        <div>
          <h2>Try Before You Buy</h2>
          <p>Book a free in-store try-on session.</p>
        </div>
        <div>
          <h3>Stav Updated</h3>
          <form onSubmit={onSubscribe}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
            />
            <button type="submit">Subscribe</button>
          </form>
          {emailStatus ? <p className="status-text">{emailStatus}</p> : null}
        </div>
      </div>
    </section>
  );
}

export default ContactSection;
