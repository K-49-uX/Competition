import mongoose from 'mongoose';

const clinicSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: String,
    services: { type: [String], default: [] },
    hours: { type: String, default: '08:00 - 17:00' },
    avgServiceMinutes: { type: Number, default: 8 },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
  },
  { timestamps: true }
);

clinicSchema.index({ location: '2dsphere' });

export const Clinic = mongoose.model('Clinic', clinicSchema);
