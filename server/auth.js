import jwt from "jsonwebtoken";
import { db, mapUserRow } from "./db.js";

export const TOKEN_COOKIE_NAME = "ife_session";
const JWT_TTL = "7d";

function getJwtSecret() {
  return process.env.JWT_SECRET || "dev-only-change-this-jwt-secret";
}

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      email: user.email
    },
    getJwtSecret(),
    { expiresIn: JWT_TTL }
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, getJwtSecret());
}

export function cookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7
  };
}

export function setAuthCookie(res, user) {
  const token = signAuthToken(user);
  res.cookie(TOKEN_COOKIE_NAME, token, cookieOptions());
}

export function clearAuthCookie(res) {
  res.clearCookie(TOKEN_COOKIE_NAME, cookieOptions());
}

function findUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function getCurrentUserFromRequest(req) {
  const token = req.cookies?.[TOKEN_COOKIE_NAME];
  if (!token) return null;

  try {
    const payload = verifyAuthToken(token);
    const userRow = findUserById(Number(payload.sub));
    if (!userRow) return null;
    return mapUserRow(userRow);
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const user = getCurrentUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  const user = getCurrentUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  req.user = user;
  next();
}
