import mongoose from 'mongoose';

const queueStateSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true, unique: true },
    currentlyServing: { type: Number, default: 0 },
    lastIssued: { type: Number, default: 0 },
    date: { type: String, required: true }, // YYYY-MM-DD; resets daily
  },
  { timestamps: true }
);

export const QueueState = mongoose.model('QueueState', queueStateSchema);
