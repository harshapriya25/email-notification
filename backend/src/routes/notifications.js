/**
 * GET /api/notifications/stream
 *
 * Server-Sent Events endpoint.
 * - On connect  → sends `init` with the 10 most recent INBOX messages
 * - Every 20 s  → polls for messages newer than the highest known
 *                 internalDate; sends `new_messages` if any found
 *
 * Uses internalDate comparison (epoch ms) rather than the Gmail
 * History API, which requires extra scopes and can be flaky.
 */

import { Router } from "express";
import { google }  from "googleapis";

import User           from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { decryptToken } from "../utils/encryption.js";

const router = Router();

const BACKEND      = process.env.BACKEND_URL || "http://localhost:5000";
const CALLBACK_URL = `${BACKEND}/api/gmail/callback`;
const POLL_MS      = 20_000; // poll every 20 seconds

/* ── helpers ──────────────────────────────────────────────── */

function makeOAuth() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    CALLBACK_URL
  );
}

/** Extract a named header from a Gmail message payload. */
function getHeader(payload, name) {
  const headers = payload?.headers || [];
  return (
    headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ""
  );
}

/**
 * Fetch up to `maxResults` INBOX messages sorted newest-first.
 * Returns an array of plain objects.
 */
async function fetchMessages(gmail, maxResults = 10, afterEpochMs = null) {
  // Build query: optionally restrict to messages after a timestamp
  let q = "in:inbox";
  if (afterEpochMs) {
    // Gmail `after:` takes Unix seconds
    const secs = Math.floor(afterEpochMs / 1000);
    q += ` after:${secs}`;
  }

  const listRes = await gmail.users.messages.list({
    userId:     "me",
    maxResults,
    q,
  });

  const ids = listRes.data.messages || [];
  if (!ids.length) return [];

  // Fetch each message's metadata in parallel
  const details = await Promise.all(
    ids.map(({ id }) =>
      gmail.users.messages
        .get({
          userId: "me",
          id,
          format:          "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        })
        .then(r => r.data)
        .catch(() => null)
    )
  );

  return details
    .filter(Boolean)
    .map(d => ({
      id:           d.id,
      threadId:     d.threadId,
      internalDate: Number(d.internalDate || 0), // epoch ms (string from API)
      subject:      getHeader(d.payload, "Subject") || "(No subject)",
      sender:       getHeader(d.payload, "From")    || "Unknown sender",
      date:         getHeader(d.payload, "Date")    || "",
      snippet:      d.snippet || "",
    }));
}

/* ── SSE route ────────────────────────────────────────────── */

router.get("/stream", requireAuth, async (req, res) => {

  /* 1 ── SSE response headers */
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  /** Write a named SSE event */
  const send = (event, data) => {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      if (typeof res.flush === "function") res.flush();
    } catch { /* connection already closed */ }
  };

  /* 2 ── Verify Gmail is connected */
  let user;
  try {
    user = await User.findById(req.user._id)
      .select("+gmailRefreshTokenEncrypted");
  } catch (err) {
    console.error("SSE: DB error", err.message);
    send("error", { message: "Server error loading account." });
    return res.end();
  }

  if (!user?.gmailConnected || !user?.gmailRefreshTokenEncrypted) {
    send("error", { message: "Gmail not connected. Please connect Gmail first." });
    return res.end();
  }

  /* 3 ── Build Gmail client */
  let gmail;
  try {
    const oauth = makeOAuth();
    oauth.setCredentials({
      refresh_token: decryptToken(user.gmailRefreshTokenEncrypted),
    });
    gmail = google.gmail({ version: "v1", auth: oauth });
  } catch (err) {
    console.error("SSE: OAuth init error", err.message);
    send("error", { message: "Could not initialise Gmail client." });
    return res.end();
  }

  /* 4 ── Initial load: seed with the 10 most recent messages */
  let knownIds        = new Set();
  let latestEpochMs   = 0;   // highest internalDate we have seen

  try {
    const messages = await fetchMessages(gmail, 10);
    messages.forEach(m => {
      knownIds.add(m.id);
      if (m.internalDate > latestEpochMs) latestEpochMs = m.internalDate;
    });
    send("init", { messages });
    console.log(`SSE: init sent ${messages.length} messages to user ${user._id}`);
  } catch (err) {
    console.error("SSE: init fetch error", err.message);
    send("error", { message: "Could not load initial emails. Try reconnecting Gmail." });
    return res.end();
  }

  /* 5 ── Polling loop */
  let alive = true;

  const intervalId = setInterval(async () => {
    if (!alive || res.writableEnded) {
      clearInterval(intervalId);
      return;
    }

    // Heartbeat comment to keep the TCP connection alive
    try { res.write(": ping\n\n"); } catch { return clearInterval(intervalId); }

    try {
      // Fetch messages newer than the latest we have seen
      // Add a 2-second buffer so we don't miss messages at the boundary
      const after = latestEpochMs > 0 ? latestEpochMs - 2000 : 0;
      const fresh = await fetchMessages(gmail, 15, after);

      const newOnes = fresh.filter(m => !knownIds.has(m.id));
      if (!newOnes.length) return;

      newOnes.forEach(m => {
        knownIds.add(m.id);
        if (m.internalDate > latestEpochMs) latestEpochMs = m.internalDate;
      });

      console.log(`SSE: pushing ${newOnes.length} new message(s) to user ${user._id}`);
      send("new_messages", { messages: newOnes });

    } catch (err) {
      console.error("SSE: poll error", err.message);
      // Don't close — transient errors (token refresh, network) are common
    }
  }, POLL_MS);

  /* 6 ── Cleanup on disconnect */
  req.on("close", () => {
    alive = false;
    clearInterval(intervalId);
    console.log(`SSE: client disconnected (user ${user._id})`);
  });
});

export default router;
