import { Link } from "@tanstack/react-router";

export default function StoreFooter({ onOpenAdmin }) {
  return (
    <footer className="preview-footer" id="contact">
      <div>
        <h2>
          Join the <em>drop list</em>.
        </h2>
        <p>Early access to new frame drops, member-only updates, and restock notes.</p>
      </div>

      <form onSubmit={(e) => e.preventDefault()}>
        <input type="email" placeholder="your@email.com" />
        <button type="submit">Join</button>
      </form>

      <nav aria-label="Footer navigation">
        <Link to="/privacy-policy">Privacy</Link>
        <Link to="/terms-of-service">Terms</Link>
        <button type="button" onClick={onOpenAdmin}>
          Admin
        </button>
      </nav>
    </footer>
  );
}