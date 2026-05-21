import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    refugeeId: { type: String, unique: true, sparse: true, index: true },
    phone: { type: String, unique: true, sparse: true, index: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    language: { type: String, enum: ['en', 'sw', 'fr', 'ar'], default: 'en' },
    role: { type: String, enum: ['patient', 'clinician', 'clinic_admin', 'admin'], default: 'patient', index: true },
    fcmTokens: { type: [String], default: [] },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', default: null },
    avatarUrl: { type: String, default: '' },
    resetTokenHash: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null },
    // Phase 6.2 — passwordless OTP login. We store only a SHA-256 hash of
    // the 6-digit code (so a leaked DB row can't be replayed) plus a
    // 10-minute expiry and an attempt counter to throttle brute force.
    otpHash: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    otpAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    refugeeId: this.refugeeId,
    phone: this.phone,
    email: this.email,
    name: this.name,
    language: this.language,
    role: this.role,
    clinicId: this.clinicId,
    avatarUrl: this.avatarUrl || '',
  };
};

export const User = mongoose.model('User', userSchema);
