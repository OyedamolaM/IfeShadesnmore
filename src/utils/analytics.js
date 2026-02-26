const GA_MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID || "").trim();

let hasInitialized = false;
let lastTrackedPath = "";

function canTrack() {
  return Boolean(GA_MEASUREMENT_ID) && typeof window !== "undefined" && typeof document !== "undefined";
}

function ensureGtagScript() {
  const existing = document.querySelector(`script[data-ga-measurement-id="${GA_MEASUREMENT_ID}"]`);
  if (existing) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  script.setAttribute("data-ga-measurement-id", GA_MEASUREMENT_ID);
  document.head.appendChild(script);
}

export function initAnalytics() {
  if (!canTrack() || hasInitialized) return;

  ensureGtagScript();
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: false,
    anonymize_ip: true
  });

  hasInitialized = true;
}

export function trackPageView(pathname) {
  if (!canTrack()) return;
  if (typeof window.gtag !== "function") return;

  const safePath = String(pathname || "/").trim() || "/";
  if (safePath === lastTrackedPath) return;
  lastTrackedPath = safePath;

  window.gtag("event", "page_view", {
    page_path: safePath,
    page_location: window.location.href,
    page_title: document.title
  });
}

export function trackEvent(name, params = {}) {
  if (!canTrack()) return;
  if (typeof window.gtag !== "function") return;

  const eventName = String(name || "").trim();
  if (!eventName) return;

  window.gtag("event", eventName, params);
}
