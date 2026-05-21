import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['sos', 'campaign', 'alert', 'queue'], required: true, index: true },
    title: String,
    message: String,
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    audience: { type: String, enum: ['all', 'patients', 'clinicians', 'admins'], default: 'all' },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', index: true },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number],
    },
    handledAt: Date,
  },
  { timestamps: true }
);

export const Notification = mongoose.model('Notification', notificationSchema);
