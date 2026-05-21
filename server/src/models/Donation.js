import mongoose from 'mongoose';

// One document per donation attempt. Created in `pending` state when the
// checkout session is opened, transitioned to `succeeded`/`failed` by the
// provider's webhook. Never store card/PAN data — only the provider's opaque
// transaction id.
const donationSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ['stub', 'stripe', 'daraja', 'flutterwave'],
      required: true,
      index: true,
    },
    providerSessionId: { type: String, default: null, index: true },
    providerTxnId: { type: String, default: null, index: true },
    amount: { type: Number, required: true, min: 1 },     // smallest currency unit (cents/centimes)
    currency: { type: String, required: true, default: 'USD', uppercase: true },
    donorName: { type: String, default: '' },
    donorEmail: { type: String, default: '', lowercase: true, trim: true },
    donorPhone: { type: String, default: '', trim: true },
    recurring: { type: Boolean, default: false },
    designation: { type: String, default: 'general' }, // general | sos | clinic | education
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
      index: true,
    },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} }, // last provider payload
  },
  { timestamps: true }
);

donationSchema.index({ status: 1, createdAt: -1 });

export const Donation = mongoose.model('Donation', donationSchema);
