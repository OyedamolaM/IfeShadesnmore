import jwt from "jsonwebtoken";
import { mapUserRow, queryOne } from "./db.js";

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

function clearCookieOptions() {
  const { maxAge, ...rest } = cookieOptions();
  void maxAge;
  return rest;
}

export function setAuthCookie(res, user) {
  const token = signAuthToken(user);
  res.cookie(TOKEN_COOKIE_NAME, token, cookieOptions());
}

export function clearAuthCookie(res) {
  res.clearCookie(TOKEN_COOKIE_NAME, clearCookieOptions());
}

async function findUserById(id) {
  return queryOne("SELECT * FROM users WHERE id = ?", [id]);
}

export async function getCurrentUserFromRequest(req) {
  const token = req.cookies?.[TOKEN_COOKIE_NAME];
  if (!token) return null;

  try {
    const payload = verifyAuthToken(token);
    const userRow = await findUserById(Number(payload.sub));
    if (!userRow) return null;
    return mapUserRow(userRow);
  } catch {
    return null;
  }
}

export async function requireAuth(req, res, next) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireAdmin(req, res, next) {
  try {
    const user = await getCurrentUserFromRequest(req);
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
  } catch (error) {
    next(error);
  }
}
