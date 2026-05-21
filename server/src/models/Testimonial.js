import mongoose from 'mongoose';
import crypto from 'node:crypto';

// Submitter consent is captured explicitly (text + timestamp + IP hash) so we
// can prove informed consent if a person later asks us to take their story
// down — required under GDPR Art. 7. The IP is one-way hashed (never stored
// in plaintext) and never shown to admins.
const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    role: {
      type: String,
      enum: ['patient', 'family', 'clinician', 'partner', 'donor', 'other'],
      default: 'patient',
      index: true,
    },
    location: { type: String, default: '', trim: true, maxlength: 80 },
    language: { type: String, enum: ['en', 'sw', 'fr', 'ar'], default: 'en', index: true },
    quote: { type: String, required: true, trim: true, minlength: 30, maxlength: 1000 },
    photoUrl: { type: String, default: '' },

    // Explicit informed consent. We require BOTH `consentGivenAt` and the
    // exact `consentText` shown to the submitter at the time of consent.
    consentGivenAt: { type: Date, required: true },
    consentText: { type: String, required: true, maxlength: 500 },
    submitterIpHash: { type: String, default: '' },

    submittedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'withdrawn'],
      default: 'pending',
      index: true,
    },
    moderatedAt: { type: Date, default: null },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    moderationNotes: { type: String, default: '', maxlength: 500 },

    featured: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

testimonialSchema.index({ status: 1, featured: -1, createdAt: -1 });

testimonialSchema.statics.hashIp = function hashIp(ip) {
  if (!ip) return '';
  // Salt the IP with a per-deploy secret so leaked DB rows can't be brute-forced
  // back to original IPs through a rainbow table.
  const salt = process.env.TESTIMONIAL_IP_SALT || process.env.JWT_SECRET || 'afya-default-salt';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
};

export const Testimonial = mongoose.model('Testimonial', testimonialSchema);
