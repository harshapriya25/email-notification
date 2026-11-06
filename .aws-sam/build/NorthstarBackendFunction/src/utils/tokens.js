import jwt from "jsonwebtoken";
import crypto from "node:crypto";

export function createAccessToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "1h", issuer: "oauth-auth-app" });
}
export function hashToken(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
export function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}
