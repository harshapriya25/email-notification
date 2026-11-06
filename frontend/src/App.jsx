
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback
} from "react";

import {
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
  useLocation
} from "react-router-dom";

import {
  ShieldCheck,
  Eye,
  EyeOff,
  Mail,
  LockKeyhole,
  UserRound,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  LogOut,
  LayoutDashboard,
  Inbox,
  RefreshCw,
  ExternalLink,
  Bell,
  X,
  MailOpen
} from "lucide-react";

import { api, oauthUrl } from "./api.js";

const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

const API_BASE = import.meta.env.VITE_API_URL || "";

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api("/me")
      .then(d => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  const refresh = async () => {
    const d = await api("/me");
    setUser(d.user);
    return d.user;
  };

  const logout = async () => {
    await api("/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      checking,
      refresh,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <ShieldCheck size={22} />
      </div>
      <span>northstar<span className="brand-dot">.</span></span>
    </div>
  );
}

function Shell({
  children,
  eyebrow = "SECURE ACCESS",
  title,
  subtitle
}) {
  return (
    <main className="auth-layout">
      <section className="visual-panel">
        <div className="visual-inner">
          <Brand />

          <div className="visual-copy">
            <div className="eyebrow light">
              <span /> YOUR IDENTITY, PROTECTED
            </div>

            <h1>
              One secure place<br />
              for everything<br />
              <em>that matters.</em>
            </h1>

            <p>
              Sign in securely and get back to what you do best.
              Your account, your data, your control.
            </p>
          </div>

          <div className="trust-row">
            <span>Trusted identity experience</span>
          </div>

          <div className="visual-foot">
            <span>© 2026 Northstar Identity</span>
            <span>Privacy-first by design</span>
          </div>
        </div>
      </section>

      <section className="form-panel">
        <div className="mobile-brand"><Brand /></div>

        <div className="form-wrap">
          <div className="eyebrow">{eyebrow}</div>
          <h2>{title}</h2>
          <p className="form-subtitle">{subtitle}</p>
          {children}
        </div>

        <div className="form-foot">
          Protected with modern authentication
          <span>·</span>
          <a
            href="https://openid.net/connect/"
            target="_blank"
            rel="noreferrer"
          >
            Learn about OpenID Connect
          </a>
        </div>
      </section>
    </main>
  );
}

function Notice({ type = "error", children }) {
  if (!children) return null;

  return (
    <div className={`notice ${type}`}>
      <span>
        {type === "success"
          ? <CheckCircle2 size={17} />
          : <AlertCircle size={17} />}
      </span>
      {children}
    </div>
  );
}

function Field({ label, icon: Icon, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        {Icon && <Icon size={18} />}
        <input {...props} />
      </div>
    </label>
  );
}

function PasswordField({
  label = "Password",
  value,
  onChange,
  placeholder = "Enter your password"
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="field">
      <span>{label}</span>

      <div className="input-wrap">
        <LockKeyhole size={18} />

        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="current-password"
        />

        <button
          className="icon-btn"
          type="button"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible
            ? <EyeOff size={18} />
            : <Eye size={18} />}
        </button>
      </div>
    </label>
  );
}

function OAuthButtons() {
  return (
    <div className="oauth-stack">
      <a className="oauth-btn" href={oauthUrl("google")}>
        <span className="google-g">G</span>
        Continue with Google
      </a>

      <a className="oauth-btn" href={oauthUrl("microsoft")}>
        <span className="ms-logo">
          <i /><i /><i /><i />
        </span>
        Continue with Microsoft
      </a>
    </div>
  );
}

function Divider() {
  return (
    <div className="divider">
      <span />or continue with email<span />
    </div>
  );
}

function Login() {
  const { refresh } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const oauthError = new URLSearchParams(loc.search).get("error");

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      return setError("Enter your email and password.");
    }

    setBusy(true);

    try {
      await api("/login", {
        method: "POST",
        body: JSON.stringify({ email, password, remember })
      });

      await refresh();
      nav("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Welcome back"
      subtitle="Enter your details to access your account."
    >
      <Notice>
        {error || (oauthError ? oauthError.replaceAll("_", " ") : "")}
      </Notice>

      <OAuthButtons />
      <Divider />

      <form onSubmit={submit} className="auth-form">
        <Field
          label="Email address"
          icon={Mail}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />

        <PasswordField
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <div className="form-options">
          <label className="check">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
            />
            <span>Remember me</span>
          </label>

          <Link to="/forgot-password" className="text-link">
            Forgot password?
          </Link>
        </div>

        <button className="primary-btn" disabled={busy}>
          {busy
            ? "Signing in..."
            : <>Sign in <ArrowRight size={18} /></>}
        </button>
      </form>

      <p className="switch-copy">
        Don't have an account? <Link to="/register">Create an account</Link>
      </p>
    </Shell>
  );
}

function Register() {
  const { refresh } = useAuth();
  const nav = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const change = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (Object.values(form).some(v => !v.trim())) {
      return setError("Complete all fields.");
    }

    if (form.password !== form.confirmPassword) {
      return setError("Passwords do not match.");
    }

    setBusy(true);

    try {
      await api("/register", {
        method: "POST",
        body: JSON.stringify(form)
      });

      await refresh();
      nav("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      eyebrow="CREATE YOUR ACCOUNT"
      title="Get started"
      subtitle="Create your account in just a few steps."
    >
      <Notice>{error}</Notice>
      <OAuthButtons />
      <Divider />

      <form className="auth-form" onSubmit={submit}>
        <Field
          label="Full name"
          icon={UserRound}
          name="fullName"
          value={form.fullName}
          onChange={change}
          placeholder="Your full name"
          autoComplete="name"
        />

        <Field
          label="Email address"
          icon={Mail}
          name="email"
          type="email"
          value={form.email}
          onChange={change}
          placeholder="you@example.com"
          autoComplete="email"
        />

        <PasswordField
          value={form.password}
          onChange={e =>
            setForm({ ...form, password: e.target.value })
          }
          label="Password"
          placeholder="At least 8 characters, including a number"
        />

        <PasswordField
          value={form.confirmPassword}
          onChange={e =>
            setForm({ ...form, confirmPassword: e.target.value })
          }
          label="Confirm password"
          placeholder="Re-enter your password"
        />

        <p className="hint">
          Use at least 8 characters with both letters and numbers.
        </p>

        <button className="primary-btn" disabled={busy}>
          {busy
            ? "Creating account..."
            : <>Create account <ArrowRight size={18} /></>}
        </button>
      </form>

      <p className="switch-copy">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </Shell>
  );
}

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const d = await api("/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email })
      });

      setMessage(d.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      eyebrow="ACCOUNT RECOVERY"
      title="Forgot password?"
      subtitle="Enter your account email and we'll send password reset instructions."
    >
      <Notice>{error}</Notice>
      {message && <Notice type="success">{message}</Notice>}

      <form className="auth-form recovery-form" onSubmit={submit}>
        <Field
          label="Email address"
          icon={Mail}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />

        <button className="primary-btn" disabled={busy}>
          {busy ? "Sending..." : "Send reset link"}
          <ArrowRight size={18} />
        </button>
      </form>

      <p className="switch-copy">
        <Link to="/login">← Back to sign in</Link>
      </p>
    </Shell>
  );
}

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();

    try {
      const token = new URLSearchParams(window.location.search).get("token");

      const d = await api("/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password, confirmPassword })
      });

      setMessage(d.message);
      setTimeout(() => nav("/login"), 1500);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell
      eyebrow="SECURE RESET"
      title="Create a new password"
      subtitle="Choose a strong password for your account."
    >
      <Notice>{error}</Notice>
      {message && <Notice type="success">{message}</Notice>}

      <form className="auth-form" onSubmit={submit}>
        <PasswordField
          value={password}
          onChange={e => setPassword(e.target.value)}
          label="New password"
        />

        <PasswordField
          value={confirmPassword}
          onChange={e => setConfirm(e.target.value)}
          label="Confirm new password"
        />

        <button className="primary-btn">
          Update password <ArrowRight size={18} />
        </button>
      </form>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// useEmailNotifications — SSE hook
// ─────────────────────────────────────────────────────────────
function useEmailNotifications(enabled) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [connected,     setConnected]     = useState(false);
  const [toasts,        setToasts]        = useState([]); // pop-up toasts
  const esRef           = useRef(null);
  const reconnectTimer  = useRef(null);
  const mountedRef      = useRef(true);

  // Add new notifications and show toasts
  function pushNew(msgs) {
    if (!msgs.length) return;
    setNotifications(prev => {
      const existingIds = new Set(prev.map(n => n.id));
      const fresh = msgs.filter(m => !existingIds.has(m.id));
      if (!fresh.length) return prev;
      return [...fresh.map(m => ({ ...m, _unread: true })), ...prev].slice(0, 100);
    });
    setUnreadCount(c => c + msgs.length);

    // Show in-app toasts for new emails
    setToasts(prev => [
      ...msgs.map(m => ({
        id:      m.id,
        subject: m.subject,
        sender:  m.sender.replace(/<[^>]+>/g, "").trim(), // strip email brackets
        at:      Date.now()
      })),
      ...prev
    ].slice(0, 5));

    // Browser native notification (works on HTTPS or localhost)
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      msgs.forEach(m => {
        try {
          new Notification(`📬 ${m.sender.replace(/<[^>]+>/g, "").trim()}`, {
            body: m.subject,
            tag:  m.id,
          });
        } catch { /* ignore */ }
      });
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Request browser notification permission on first load
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }

    let retryCount = 0;

    function connect() {
      if (!mountedRef.current) return;

      const url = `${API_BASE}/api/notifications/stream`;
      console.log("[SSE] Connecting to", url);

      const es = new EventSource(url, { withCredentials: true });
      esRef.current = es;

      // Connection opened successfully
      es.onopen = () => {
        console.log("[SSE] Connected");
        retryCount = 0;
        if (mountedRef.current) setConnected(true);
      };

      // Named event: initial seed
      es.addEventListener("init", e => {
        console.log("[SSE] init event received");
        if (!mountedRef.current) return;
        setConnected(true);
        try {
          const data = JSON.parse(e.data);
          if (data.messages?.length) {
            // Seed without marking as unread
            setNotifications(data.messages.map(m => ({ ...m, _unread: false })));
          }
        } catch (err) {
          console.error("[SSE] Failed to parse init:", err);
        }
      });

      // Named event: new messages arrived
      es.addEventListener("new_messages", e => {
        console.log("[SSE] new_messages event received");
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(e.data);
          if (data.messages?.length) pushNew(data.messages);
        } catch (err) {
          console.error("[SSE] Failed to parse new_messages:", err);
        }
      });

      // Named event: server error
      es.addEventListener("error_msg", e => {
        try {
          const data = JSON.parse(e.data);
          console.warn("[SSE] Server error:", data.message);
        } catch { /* */ }
      });

      // Connection error / dropped — EventSource will auto-retry
      // We mirror that by updating state
      es.onerror = (err) => {
        console.warn("[SSE] Connection error", err);
        if (!mountedRef.current) return;
        setConnected(false);
        es.close();
        esRef.current = null;

        // Exponential back-off: 5s, 10s, 20s … max 60s
        const delay = Math.min(5000 * Math.pow(2, retryCount), 60_000);
        retryCount++;
        console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${retryCount})`);
        reconnectTimer.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
      clearTimeout(reconnectTimer.current);
      if (mountedRef.current) setConnected(false);
    };
  }, [enabled]); // only re-run when enabled changes

  // Auto-dismiss toasts after 5 s
  useEffect(() => {
    if (!toasts.length) return;
    const timer = setTimeout(() => {
      const cutoff = Date.now() - 5000;
      setToasts(prev => prev.filter(t => t.at > cutoff));
    }, 5100);
    return () => clearTimeout(timer);
  }, [toasts]);

  const markAllRead = useCallback(() => setUnreadCount(0), []);
  const dismissNotif = useCallback(id => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    setUnreadCount(c => Math.max(0, c - 1));
  }, []);
  const dismissToast = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    connected,
    toasts,
    markAllRead,
    dismissNotif,
    dismissToast,
    clearAll,
  };
}

// ─────────────────────────────────────────────────────────────
// EmailToasts — floating pop-up banners
// ─────────────────────────────────────────────────────────────
function EmailToasts({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="toast-item">
          <div className="toast-icon"><Mail size={15} /></div>
          <div className="toast-body">
            <p className="toast-subject">{t.subject}</p>
            <p className="toast-sender">{t.sender}</p>
          </div>
          <button
            className="toast-dismiss"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NotificationBell component
// ─────────────────────────────────────────────────────────────
function NotificationBell({ gmailConnected }) {
  const {
    notifications,
    unreadCount,
    connected,
    toasts,
    markAllRead,
    dismissNotif,
    dismissToast,
    clearAll,
  } = useEmailNotifications(gmailConnected);

  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function toggle() {
    setOpen(v => {
      if (!v) markAllRead();
      return !v;
    });
  }

  function formatTime(raw) {
    if (!raw) return "";
    try {
      const d = new Date(raw);
      if (isNaN(d)) return raw;
      const now = new Date();
      const isToday =
        d.getDate()     === now.getDate() &&
        d.getMonth()    === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
      return isToday
        ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch { return raw; }
  }

  return (
    <>
      {/* Floating toast stack — always visible */}
      <EmailToasts toasts={toasts} onDismiss={dismissToast} />

      <div className="notif-wrapper" ref={panelRef}>
        {/* Bell button */}
        <button
          className={`notif-bell${open ? " notif-bell--open" : ""}`}
          onClick={toggle}
          aria-label="Notifications"
          title={gmailConnected
            ? "Email notifications"
            : "Connect Gmail to enable notifications"}
        >
          <Bell size={19} />
          {unreadCount > 0 && (
            <span className="notif-badge">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          {gmailConnected && (
            <span className={`notif-dot ${connected ? "notif-dot--on" : "notif-dot--off"}`} />
          )}
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="notif-panel" role="dialog" aria-label="Notifications panel">
            {/* Head */}
            <div className="notif-panel-head">
              <div className="notif-panel-title">
                <Inbox size={16} />
                <span>Inbox Notifications</span>
                {connected && gmailConnected && (
                  <span className="notif-live-pill">● LIVE</span>
                )}
              </div>
              <div className="notif-panel-actions">
                {notifications.length > 0 && (
                  <button className="notif-text-btn" onClick={clearAll}>
                    Clear all
                  </button>
                )}
                <button className="notif-close-btn" onClick={() => setOpen(false)}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="notif-panel-body">
              {!gmailConnected ? (
                <div className="notif-empty">
                  <MailOpen size={34} />
                  <p>Connect your Gmail account to receive real-time email notifications.</p>
                </div>
              ) : !connected && notifications.length === 0 ? (
                <div className="notif-empty">
                  <LoaderCircle className="spin" size={28} />
                  <p>Connecting to Gmail…</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="notif-empty">
                  <MailOpen size={34} />
                  <p>No emails yet.<br />Polling every 20 s…</p>
                </div>
              ) : (
                <ul className="notif-list">
                  {notifications.map(n => (
                    <li
                      key={n.id}
                      className={`notif-item${n._unread ? " notif-item--unread" : ""}`}
                    >
                      <div className="notif-item-icon">
                        <Mail size={14} />
                      </div>
                      <div className="notif-item-body">
                        <p className="notif-item-subject">{n.subject}</p>
                        <p className="notif-item-sender">
                          {n.sender.replace(/<[^>]+>/g, "").trim()}
                        </p>
                        {n.snippet && (
                          <p className="notif-item-snippet">
                            {n.snippet.slice(0, 90)}
                            {n.snippet.length > 90 ? "…" : ""}
                          </p>
                        )}
                        <p className="notif-item-time">{formatTime(n.date)}</p>
                      </div>
                      <button
                        className="notif-dismiss-btn"
                        onClick={() => dismissNotif(n.id)}
                        aria-label="Dismiss"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            {gmailConnected && (
              <div className="notif-panel-foot">
                <span className={`notif-status-dot ${connected ? "on" : "off"}`} />
                {connected ? "Live — polling every 20 s" : "Reconnecting…"}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Protected({ children }) {
  const { user, checking } = useAuth();

  if (checking) {
    return (
      <div className="loading-screen">
        <LoaderCircle className="spin" size={28} />
        Checking your session...
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

function Dashboard() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [gmailNotice, setGmailNotice] = useState("");

  const initials = user.fullName
    .split(" ")
    .map(x => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const status = params.get("gmail");

    if (status === "connected") {
      setGmailNotice("Gmail connected successfully!");
      nav("/dashboard", { replace: true });
    } else if (status === "error") {
      setGmailNotice("Gmail connection failed. Please try again.");
      nav("/dashboard", { replace: true });
    }
  }, [loc.search, nav]);

  async function signout() {
    setBusy(true);

    try {
      await logout();
      nav("/login");
    } finally {
      setBusy(false);
    }
  }

  function connectGmail() {
    window.location.href = `${API_BASE}/api/gmail/connect`;
  }

  async function loadEmails() {
    setLoadingEmails(true);
    setEmailError("");
    setMessages([]);

    try {
      const response = await fetch(
        `${API_BASE}/api/gmail/messages`,
        {
          method: "GET",
          credentials: "include"
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to load emails.");
      }

      setMessages(data.messages || []);
    } catch (err) {
      setEmailError(err.message);
    } finally {
      setLoadingEmails(false);
    }
  }

  return (
    <div className="dashboard">
      <header className="dash-header">
        <Brand />

        <div className="dash-header-right">
          <NotificationBell gmailConnected={!!user.gmailConnected} />

          <button
            className="logout-btn"
            onClick={signout}
            disabled={busy}
          >
            <LogOut size={17} />
            {busy ? "Signing out" : "Sign out"}
          </button>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-icon">
          <LayoutDashboard size={24} />
        </div>

        <div className="eyebrow">YOUR WORKSPACE</div>

        <h1>Welcome back, {user.fullName.split(" ")[0]}.</h1>

        <p className="dash-lead">
          You're signed in. Your account is secure and ready to go.
        </p>

        <section className="profile-card">
          <div className="profile-top">
            <div className="avatar">{initials}</div>

            <div>
              <h3>{user.fullName}</h3>
              <p>{user.email}</p>
            </div>

            <span className="status"><i /> Active</span>
          </div>

          <div className="profile-details">
            <div>
              <span>AUTHENTICATION METHOD</span>
              <strong className="provider-label">
                {user.provider === "local"
                  ? "Email & password"
                  : user.provider === "google"
                    ? "Google"
                    : "Microsoft"}
              </strong>
            </div>

            <div>
              <span>ACCOUNT CREATED</span>
              <strong>
                {new Date(user.createdAt).toLocaleDateString(
                  undefined,
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                  }
                )}
              </strong>
            </div>

            <div>
              <span>ACCOUNT STATUS</span>
              <strong className="verified">
                <CheckCircle2 size={16} /> Verified session
              </strong>
            </div>
          </div>
        </section>

        <section className="profile-card gmail-card">
          <div className="eyebrow">EMAIL INTELLIGENCE</div>

          <h2>
            <Inbox size={23} /> Gmail Assistant
          </h2>

          <p>
            Connect your Gmail account to retrieve your recent
            messages and prepare them for AI summarization.
          </p>

          {gmailNotice && (
            <Notice type="success">{gmailNotice}</Notice>
          )}

          <div className="gmail-actions">
            <button
              className="primary-btn"
              onClick={connectGmail}
            >
              <Mail size={18} /> Connect Gmail
            </button>

            <button
              className="logout-btn"
              onClick={loadEmails}
              disabled={loadingEmails}
            >
              {loadingEmails
                ? <LoaderCircle className="spin" size={18} />
                : <RefreshCw size={18} />}
              Load Emails
            </button>
          </div>

          {emailError && <Notice>{emailError}</Notice>}

          {loadingEmails && (
            <p className="email-loading-text">
              <LoaderCircle className="spin" size={16} />
              Loading your latest emails…
            </p>
          )}

          {messages.length > 0 && (
            <div className="email-list">
              <h3>Recent Emails ({messages.length})</h3>

              {messages.map(message => (
                <article className="email-item" key={message.id}>
                  <div className="email-item-top">
                    <strong>{message.subject || "(No subject)"}</strong>
                    <span>{message.date}</span>
                  </div>

                  <p className="email-sender">
                    From: {message.sender}
                  </p>

                  <p>{message.snippet || message.body || "No preview available."}</p>
                </article>
              ))}
            </div>
          )}

          {!loadingEmails && messages.length === 0 && !emailError && (
            <p className="hint">
              Connect Gmail first, then select Load Emails.
            </p>
          )}
        </section>

        <div className="security-note">
          <ShieldCheck size={19} />
          <p>
            <strong>Your security matters.</strong>
            Your session is protected with an HTTP-only authentication cookie.
          </p>
        </div>
      </main>

      <footer className="dash-footer">
        Northstar Identity <span>·</span> Secure authentication demo
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/dashboard"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}
