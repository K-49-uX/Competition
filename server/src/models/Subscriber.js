import mongoose from 'mongoose';

// Newsletter subscriber. Double-opt-in: created with status `pending` and a
// confirm token; flipped to `confirmed` when the user clicks the email link.
// Until 6.1 (transactional email) lands, the dev mode just returns the token
// in the response so flows can be tested manually.
const subscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, default: '' },
    language: { type: String, enum: ['en', 'sw', 'fr', 'ar'], default: 'en' },
    source: { type: String, default: 'donate-page' },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'unsubscribed'],
      default: 'pending',
      index: true,
    },
    confirmTokenHash: { type: String, default: null },
    confirmedAt: { type: Date, default: null },
    unsubscribedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Subscriber = mongoose.model('Subscriber', subscriberSchema);
