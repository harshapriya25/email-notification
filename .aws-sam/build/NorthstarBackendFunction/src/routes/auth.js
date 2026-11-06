import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { createRemoteJWKSet, jwtVerify } from "jose";
import User from "../models/User.js";
import { createAccessToken, hashToken, randomToken } from "../utils/tokens.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";
const BACKEND = process.env.BACKEND_URL || "http://localhost:5000";

function setAuthCookie(res, user) {
  res.cookie("access_token", createAccessToken(user), {
    httpOnly: true, secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax", maxAge: 60 * 60 * 1000, path: "/"
  });
}
function publicUser(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    provider: user.oauthProvider,
    createdAt: user.createdAt,
    gmailConnected: !!user.gmailConnected,
    gmailEmail: user.gmailEmail || null
  };
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function oauthConfig(provider) {
  if (provider === "google") return {
    clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callback: process.env.GOOGLE_CALLBACK_URL || `${BACKEND}/api/auth/google/callback`,
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    jwks: "https://www.googleapis.com/oauth2/v3/certs",
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    scope: "openid email profile"
  };
  const tenant = process.env.MICROSOFT_TENANT_ID || "common";
  return {
    clientId: process.env.MICROSOFT_CLIENT_ID, clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    callback: process.env.MICROSOFT_CALLBACK_URL || `${BACKEND}/api/auth/microsoft/callback`,
    authorize: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    token: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    jwks: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
    microsoft: true, scope: "openid profile email"
  };
}
const jwksCache = new Map();
function getJwks(url) {
  if (!jwksCache.has(url)) jwksCache.set(url, createRemoteJWKSet(new URL(url)));
  return jwksCache.get(url);
}

router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body || {};
    if (!fullName?.trim() || fullName.trim().length < 2) return res.status(400).json({ message: "Enter your full name (at least 2 characters)." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) return res.status(400).json({ message: "Enter a valid email address." });
    if (typeof password !== "string" || password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return res.status(400).json({ message: "Password must be at least 8 characters and contain a letter and a number." });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match." });
    const normalizedEmail = email.toLowerCase().trim();
    if (await User.findOne({ email: normalizedEmail })) return res.status(409).json({ message: "An account with this email already exists. Please sign in." });
    const user = await User.create({ fullName: fullName.trim(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), oauthProvider: "local" });
    setAuthCookie(res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "An account with this email already exists." });
    console.error("Registration error:", error);
    res.status(500).json({ message: "Could not create your account." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+passwordHash");
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: "Incorrect email or password." });
    setAuthCookie(res, user);
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Sign in failed. Please try again." });
  }
});

router.get("/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
router.post("/logout", (req, res) => {
  res.clearCookie("access_token", { httpOnly: true, secure: process.env.COOKIE_SECURE === "true", sameSite: "lax", path: "/" });
  if (req.session) req.session.destroy(() => res.json({ message: "Signed out successfully." }));
  else res.json({ message: "Signed out successfully." });
});

router.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "").toLowerCase().trim();
    const user = await User.findOne({ email }).select("+resetTokenHash +resetTokenExpires +passwordHash");
    // Keep the response generic to avoid account enumeration.
    if (user && user.passwordHash) {
      const token = randomToken();
      user.resetTokenHash = hashToken(token);
      user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();
      const link = `${FRONTEND}/reset-password?token=${token}`;
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
        await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: user.email, subject: "Reset your password", text: `Use this link within 30 minutes: ${link}` });
      } else if (process.env.NODE_ENV !== "production") {
        console.log(`Password reset link for ${email}: ${link}`);
      }
    }
    res.json({ message: "If an account exists for that email, password reset instructions have been sent." });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Unable to process the request right now." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body || {};
    if (typeof password !== "string" || password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return res.status(400).json({ message: "Password must be at least 8 characters and contain a letter and a number." });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match." });
    const user = await User.findOne({ resetTokenHash: hashToken(token || ""), resetTokenExpires: { $gt: new Date() } }).select("+resetTokenHash +resetTokenExpires +passwordHash");
    if (!user) return res.status(400).json({ message: "This reset link is invalid or has expired." });
    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetTokenHash = null; user.resetTokenExpires = null;
    await user.save();
    res.json({ message: "Password updated. You can now sign in." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Could not reset password." });
  }
});

router.get("/:provider", (req, res) => {
  const provider = req.params.provider;
  if (!["google", "microsoft"].includes(provider)) return res.status(404).send("Unknown provider");
  const cfg = oauthConfig(provider);
  if (!cfg.clientId || !cfg.clientSecret) return res.redirect(`${FRONTEND}/login?error=${provider}_not_configured`);
  const state = randomToken(), nonce = randomToken(), verifier = randomToken();
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  req.session.oauth = { provider, state, nonce, verifier, createdAt: Date.now() };
  const url = new URL(cfg.authorize);
  url.search = new URLSearchParams({
    client_id: cfg.clientId, response_type: "code", redirect_uri: cfg.callback,
    response_mode: "query", scope: cfg.scope, state, nonce,
    code_challenge: challenge, code_challenge_method: "S256",
    ...(provider === "google" ? { access_type: "online" } : {})
  }).toString();
  res.redirect(url.toString());
});

router.get("/:provider/callback", async (req, res) => {
  const provider = req.params.provider;
  const cfg = oauthConfig(provider);
  try {
    const saved = req.session?.oauth;
    delete req.session.oauth;
    if (!saved || saved.provider !== provider || !safeEqual(saved.state, req.query.state) || Date.now() - saved.createdAt > 10 * 60 * 1000) throw new Error("OAuth state validation failed. Please try again.");
    if (req.query.error) throw new Error(String(req.query.error_description || req.query.error));
    if (!req.query.code) throw new Error("Authorization code was not returned.");
    const body = new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, code: String(req.query.code), redirect_uri: cfg.callback, grant_type: "authorization_code", code_verifier: saved.verifier });
    const tokenResponse = await fetch(cfg.token, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.id_token) throw new Error(tokenData.error_description || "Could not exchange OAuth authorization code.");
    const { payload } = await jwtVerify(tokenData.id_token, getJwks(cfg.jwks), { audience: cfg.clientId, ...(cfg.issuer ? { issuer: cfg.issuer } : {}), clockTolerance: 5 });
    if (!safeEqual(payload.nonce, saved.nonce)) throw new Error("OAuth nonce validation failed.");
    if (cfg.microsoft) {
      if (!payload.tid || !String(payload.iss || "").startsWith(`https://login.microsoftonline.com/${payload.tid}/v2.0`)) throw new Error("Microsoft token issuer is invalid.");
    }
    const email = String(payload.email || payload.preferred_username || payload.upn || "").toLowerCase().trim();
    const providerId = String(payload.sub || payload.oid || "");
    const fullName = String(payload.name || email.split("@")[0] || "User").slice(0, 100);
    if (!email || !providerId) throw new Error("The provider did not return a usable email and account identifier.");
    let user = await User.findOne({ oauthProvider: provider, oauthProviderId: providerId });
    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        if (user.oauthProvider !== "local" && user.oauthProvider !== provider) throw new Error("This email is already linked to another sign-in provider. Sign in using that provider.");
        user.oauthProvider = provider; user.oauthProviderId = providerId;
        if (!user.fullName) user.fullName = fullName;
        await user.save();
      } else {
        user = await User.create({ fullName, email, oauthProvider: provider, oauthProviderId: providerId });
      }
    }
    setAuthCookie(res, user);
    res.redirect(`${FRONTEND}/dashboard`);
  } catch (error) {
    console.error(`${provider} OAuth error:`, error.message);
    res.redirect(`${FRONTEND}/login?error=${encodeURIComponent(error.message || "OAuth sign in failed.")}`);
  }
});

export default router;
