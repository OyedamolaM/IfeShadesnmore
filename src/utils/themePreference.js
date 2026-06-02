export const THEME_STORAGE_KEY = "ife_preview_theme";
export const THEME_COOKIE_KEY = "ife_preview_theme";

export function normalizeThemeVariant(value) {
  return value === "v2" || value === "v3" ? value : "v1";
}

export function getThemeCookieValue() {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${THEME_COOKIE_KEY}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : "";
}

export function getStoredThemeVariant() {
  if (typeof window === "undefined") return "v1";
  return normalizeThemeVariant(
    window.localStorage.getItem(THEME_STORAGE_KEY) || getThemeCookieValue()
  );
}

export function persistThemeVariant(value) {
  if (typeof window === "undefined") return;
  const theme = normalizeThemeVariant(value);
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.cookie = `${THEME_COOKIE_KEY}=${encodeURIComponent(theme)}; path=/; max-age=31536000; SameSite=Lax`;
  document.documentElement.dataset.ifeTheme = theme;
}
