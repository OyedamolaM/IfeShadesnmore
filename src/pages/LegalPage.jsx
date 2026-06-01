import { Link } from "@tanstack/react-router";

const CONTACT_EMAIL = "oluborodedeborah2000@gmail.com";
const CONTACT_PHONE = "09063556765";
const BUSINESS_ADDRESS = "1, Sunday Akinbo Str, command Ipaja, Lagos";

const LEGAL_PAGES = {
  privacy: {
    title: "Privacy Policy",
    updated: "June 1, 2026",
    intro:
      "This Privacy Policy explains how IfeShades & More collects, uses, and protects customer information when you browse our website, create an account, place an order, or contact us.",
    sections: [
      {
        heading: "Information we collect",
        body: [
          "We may collect your name, email address, phone number, delivery address, city, order details, account login details, and messages you send to us.",
          "When you subscribe for updates, we collect your email address so we can send offers, availability updates, and store news."
        ]
      },
      {
        heading: "How we use your information",
        body: [
          "We use your information to process orders, arrange delivery, provide customer support, maintain your account, send subscribed updates, prevent fraud, and improve the shopping experience.",
          "We do not sell your personal information."
        ]
      },
      {
        heading: "Payments",
        body: [
          "Payments are handled through Paystack. We do not store your full card details on this website.",
          "Paystack may process payment information according to its own security and privacy practices."
        ]
      },
      {
        heading: "Cookies and analytics",
        body: [
          "The website may use local storage, cookies, and analytics tools to keep your cart working, understand site usage, and improve performance.",
          "You can control cookies through your browser settings, but some shopping features may not work properly if storage is disabled."
        ]
      },
      {
        heading: "Your choices",
        body: [
          "You can contact us to request access, correction, or deletion of your personal information, subject to order, legal, and security requirements.",
          "You can opt out of marketing updates by contacting us or using any unsubscribe option provided in our messages."
        ]
      }
    ]
  },
  terms: {
    title: "Terms of Service",
    updated: "June 1, 2026",
    intro:
      "These Terms of Service explain the rules for using the IfeShades & More website and placing orders with us.",
    sections: [
      {
        heading: "Orders and account details",
        body: [
          "By placing an order, you agree to provide accurate customer, delivery, and payment information.",
          "You are responsible for keeping your account login details secure and for activity that happens under your account."
        ]
      },
      {
        heading: "Products, prices, and availability",
        body: [
          "We aim to keep product details, prices, and availability accurate, but they may change without notice.",
          "If an item becomes unavailable after you order, we will contact you about a replacement, preorder option, refund, or cancellation."
        ]
      },
      {
        heading: "Payment and order confirmation",
        body: [
          "Orders are confirmed after successful payment or after we approve another accepted payment arrangement.",
          "Online card payments are processed through Paystack. We may cancel or review orders that appear incomplete, suspicious, or incorrectly priced."
        ]
      },
      {
        heading: "Delivery, returns, and support",
        body: [
          "Delivery timing may depend on product availability, location, courier service, and payment confirmation.",
          "For returns, exchanges, damaged items, or order issues, contact us as soon as possible with your order details."
        ]
      },
      {
        heading: "Website use",
        body: [
          "You agree not to misuse the website, attempt unauthorized access, interfere with checkout, or copy website content for commercial use without permission.",
          "We may update these terms when needed. Continued use of the website means you accept the latest version."
        ]
      }
    ]
  }
};

function LegalPage({ type }) {
  const page = LEGAL_PAGES[type] || LEGAL_PAGES.privacy;

  return (
    <div className="page legal-page">
      <main className="site-shell legal-shell">
        <section className="container legal-page-inner">
          <Link className="legal-back-link" to="/">
            Back to store
          </Link>
          <div className="legal-heading">
            <p>Last updated: {page.updated}</p>
            <h1>{page.title}</h1>
            <p>{page.intro}</p>
          </div>

          <div className="legal-content">
            {page.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ))}

            <section>
              <h2>Contact us</h2>
              <p>
                For questions about this page, your order, or your personal information, contact IfeShades & More at{" "}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>,{" "}
                <a href={`tel:${CONTACT_PHONE}`}>{CONTACT_PHONE}</a>, or visit us at {BUSINESS_ADDRESS}.
              </p>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

export default LegalPage;
