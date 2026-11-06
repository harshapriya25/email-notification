
import { Router } from "express";
import crypto from "node:crypto";
import { google } from "googleapis";

import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { encryptToken } from "../utils/encryption.js";


const router = Router();

const FRONTEND =
  process.env.FRONTEND_URL || "http://localhost:5173";

const BACKEND =
  process.env.BACKEND_URL || "http://localhost:5000";

const CALLBACK_URL = `${BACKEND}/api/gmail/callback`;

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    CALLBACK_URL
  );
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));

  return (
    aa.length === bb.length &&
    crypto.timingSafeEqual(aa, bb)
  );
}

// Connect Gmail account
router.get("/connect", requireAuth, (req, res) => {
  try {
    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET
    ) {
      return res.status(500).json({
        message: "Google OAuth is not configured."
      });
    }

    const state = crypto.randomBytes(32).toString("hex");

    req.session.gmailOAuth = {
      state,
      userId: String(req.user._id),
      createdAt: Date.now()
    };

    const oauth2Client = createOAuthClient();

    const authorizationUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      scope: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.readonly"
      ],
      state
    });

    res.redirect(authorizationUrl);

  } catch (error) {
    console.error("Gmail connect error:", error.message);

    res.status(500).json({
      message: "Unable to start Gmail connection."
    });
  }
});

// Gmail OAuth callback
router.get("/callback", async (req, res) => {
  try {
    const saved = req.session?.gmailOAuth;

    if (req.session) {
      delete req.session.gmailOAuth;
    }

    if (
      !saved ||
      !safeEqual(saved.state, req.query.state) ||
      Date.now() - saved.createdAt > 10 * 60 * 1000
    ) {
      throw new Error("Gmail authorization state is invalid or expired.");
    }

    if (req.query.error) {
      throw new Error("Gmail permission was not granted.");
    }

    const code = String(req.query.code || "");

    if (!code) {
      throw new Error("Authorization code is missing.");
    }

    const oauth2Client = createOAuthClient();

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error("Google did not return an access token.");
    }

    oauth2Client.setCredentials(tokens);

    // Verify connected Google account
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2"
    });

    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email || !profile.verified_email) {
      throw new Error("Google account could not be verified.");
    }

    // Find Northstar Identity user
    const user = await User.findById(saved.userId).select(
      "+gmailRefreshTokenEncrypted"
    );

    if (!user) {
      throw new Error("Northstar Identity user not found.");
    }

    // Preserve an existing refresh token if Google does not return
    // a new one during a subsequent authorization.
    const refreshToken =
      tokens.refresh_token ||
      (
        user.gmailEmail?.toLowerCase() === profile.email.toLowerCase()
          ? user.gmailRefreshTokenEncrypted
            ? null
            : null
          : null
      );

    if (tokens.refresh_token) {
      user.gmailRefreshTokenEncrypted = encryptToken(
        tokens.refresh_token
      );
    } else if (
      !user.gmailRefreshTokenEncrypted ||
      user.gmailEmail?.toLowerCase() !== profile.email.toLowerCase()
    ) {
      throw new Error(
        "Google did not return a refresh token. Revoke the previous Northstar Identity consent and reconnect Gmail."
      );
    }

    user.gmailConnected = true;
    user.gmailEmail = profile.email.toLowerCase();

    if (!user.gmailConnectedAt) {
      user.gmailConnectedAt = new Date();
    }

    await user.save();

    res.redirect(
      `${FRONTEND}/dashboard?gmail=connected`
    );

  } catch (error) {
    console.error("Gmail OAuth error:", error.message);

    res.redirect(
      `${FRONTEND}/dashboard?gmail=error`
    );
  }
});


import { decryptToken } from "../utils/encryption.js";

// Get recent Gmail messages
router.get("/messages", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("+gmailRefreshTokenEncrypted");

    if (
      !user ||
      !user.gmailConnected ||
      !user.gmailRefreshTokenEncrypted
    ) {
      return res.status(400).json({
        message: "Please connect your Gmail account first."
      });
    }

    const oauth2Client = createOAuthClient();

    oauth2Client.setCredentials({
      refresh_token: decryptToken(
        user.gmailRefreshTokenEncrypted
      )
    });

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client
    });

    const response = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10
    });

    const messageIds = response.data.messages || [];

    const messages = await Promise.all(
      messageIds.map(async (message) => {
        const result = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "full"
        });

        const headers = result.data.payload?.headers || [];

        const getHeader = (name) =>
          headers.find(
            (header) =>
              header.name.toLowerCase() === name.toLowerCase()
          )?.value || "";

        const parts = result.data.payload?.parts || [];

        const textPart =
          parts.find(
            (part) => part.mimeType === "text/plain"
          ) ||
          (result.data.payload?.mimeType === "text/plain"
            ? result.data.payload
            : null);

        let body = "";

        if (textPart?.body?.data) {
          body = Buffer.from(
            textPart.body.data,
            "base64url"
          ).toString("utf8");
        }

        return {
          id: result.data.id,
          sender: getHeader("From"),
          subject: getHeader("Subject"),
          date: getHeader("Date"),
          snippet: result.data.snippet || "",
          body: body.slice(0, 12000)
        };
      })
    );

    res.json({
      success: true,
      count: messages.length,
      messages
    });

  } catch (error) {
    console.error("Gmail messages error:", error.message);

    res.status(500).json({
      message: "Unable to retrieve Gmail messages."
    });
  }
});


export default router;
