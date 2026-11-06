
import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import MongoStore from "connect-mongo";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.js";
import gmailRoutes from "./routes/gmail.js";
import notificationRoutes from "./routes/notifications.js";

const app = express();

const frontend =
  process.env.FRONTEND_URL || "http://localhost:5173";

app.set("trust proxy", 1);

// Security middleware
app.use(helmet());

app.use(
  cors({
    origin: frontend,
    credentials: true
  })
);

app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

// Session configuration
app.use(
  session({
    name: "oauth_session",
    secret:
      process.env.SESSION_SECRET ||
      "development-only-change-this-secret",
    resave: false,
    saveUninitialized: false,

    store: process.env.MONGODB_URI
      ? MongoStore.create({
          mongoUrl: process.env.MONGODB_URI,
          collectionName: "sessions",
          ttl: 10 * 60
        })
      : undefined,

    cookie: {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      maxAge: 10 * 60 * 1000
    }
  })
);

// Authentication routes
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use("/api/auth", authRoutes);

// Gmail routes
app.use(
  "/api/gmail",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use("/api/gmail", gmailRoutes);

// Notification SSE route (no extra rate-limit — keep-alive connection)
app.use("/api/notifications", notificationRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Northstar Identity API is running"
  });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Application error:", err);

  res.status(500).json({
    message: "Unexpected server error."
  });
});

export default app;
