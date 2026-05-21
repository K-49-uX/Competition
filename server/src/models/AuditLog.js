import mongoose from 'mongoose';
import crypto from 'node:crypto';

// Tamper-evident audit log. Each entry stores a SHA-256 hash of
// (previousHash + serialized current entry), so any retrospective edit breaks
// the chain and is detectable by the nightly verifier (Phase 4.1).
//
// Writes go through helpers in middleware/audit.js — never call .create()
// directly, otherwise the chain pointer (`prevHash`) won't be set.
const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, index: true }, // e.g. "appointment.book"
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorRole: { type: String, default: null },
    actorIp: { type: String, default: null },
    resource: { type: String, default: null, index: true },   // e.g. "Appointment"
    resourceId: { type: String, default: null, index: true }, // stringified id
    method: { type: String, default: null },
    path: { type: String, default: null },
    status: { type: Number, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    prevHash: { type: String, default: null },
    hash: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.statics.computeHash = function (entry, prevHash) {
  const payload = JSON.stringify({
    action: entry.action,
    actorId: entry.actorId ? String(entry.actorId) : null,
    actorRole: entry.actorRole || null,
    resource: entry.resource || null,
    resourceId: entry.resourceId || null,
    method: entry.method || null,
    path: entry.path || null,
    status: entry.status ?? null,
    metadata: entry.metadata || {},
    createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
    prev: prevHash || null,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
};

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
