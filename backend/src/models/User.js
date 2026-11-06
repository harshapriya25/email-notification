import mongoose from "mongoose";

const providerSchema = new mongoose.Schema({
  provider: { type: String, required: true },
  providerId: { type: String, required: true },
  linkedAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, select: false, default: null },
  providers: { type: [providerSchema], default: [] },
  oauthProvider: { type: String, default: "local" },
  oauthProviderId: { type: String, default: null },
  // Gmail integration
gmailConnected: {
  type: Boolean,
  default: false
},
gmailEmail: {
  type: String,
  default: null
},
gmailRefreshTokenEncrypted: {
  type: String,
  default: null,
  select: false
},
gmailConnectedAt: {
  type: Date,
  default: null
},
  resetTokenHash: { type: String, select: false, default: null },
  resetTokenExpires: { type: Date, select: false, default: null }
}, { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } });

userSchema.index({ "providers.provider": 1, "providers.providerId": 1 }, { sparse: true });
userSchema.index({ oauthProvider: 1, oauthProviderId: 1 }, { sparse: true, partialFilterExpression: { oauthProviderId: { $type: "string" } } });

export default mongoose.model("User", userSchema);
