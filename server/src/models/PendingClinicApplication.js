import mongoose from 'mongoose';

// Phase 3.5 — Self-onboarding for clinic admins. A prospective clinic
// submits this application (no auth) and a super-admin reviews it.
// The actual Clinic + clinic_admin User are only created on approval.
//
// Status machine:
//   pending          → email not yet verified
//   email_verified   → applicant clicked the verification link
//   approved         → super-admin reviewed and accepted; Clinic+User created
//   rejected         → super-admin reviewed and declined
const pendingClinicApplicationSchema = new mongoose.Schema(
  {
    clinicName: { type: String, required: true, trim: true },
    address: { type: String, default: '' },
    hours: { type: String, default: '08:00 - 17:00' },
    services: { type: [String], default: [] },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },

    // Applicant — becomes the clinic_admin user on approval. We store the
    // bcrypt hash (not the plaintext) so the password is never readable
    // even by reviewers; it's only ever set by the applicant.
    adminName: { type: String, required: true, trim: true },
    adminEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    adminPhone: { type: String, default: '' },
    adminPasswordHash: { type: String, required: true },

    // SHA-256 hash of the email-verification token. Mirrors the
    // password-reset pattern on User so a leaked DB row can't be replayed.
    verifyTokenHash: { type: String, default: null },
    verifyTokenExpiresAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ['pending', 'email_verified', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },

    // IDs of artifacts created on approval, for audit trace.
    createdClinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', default: null },
    createdAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const PendingClinicApplication = mongoose.model(
  'PendingClinicApplication',
  pendingClinicApplicationSchema
);
