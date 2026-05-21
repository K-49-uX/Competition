import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Appointment } from '../models/Appointment.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getIo } from '../realtime/io.js';

const router = Router();

// Public Jitsi room base. Self-hosting later only requires changing this
// constant + (optionally) baking in a JWT for moderator privileges.
const JITSI_BASE = process.env.JITSI_BASE_URL || 'https://meet.jit.si';

const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Build a join payload that includes the host URL so the client can either
// embed via iframe or open in a new tab without re-deriving the URL.
function joinPayload(appt) {
  if (!appt.teleconsult?.enabled || !appt.teleconsult.roomName) return null;
  return {
    enabled: true,
    provider: appt.teleconsult.provider || 'jitsi',
    roomName: appt.teleconsult.roomName,
    joinUrl: `${JITSI_BASE}/${encodeURIComponent(appt.teleconsult.roomName)}`,
    createdAt: appt.teleconsult.createdAt,
    endedAt: appt.teleconsult.endedAt,
  };
}

// Authorisation helper: clinicians/admins can always see; patients only on
// their own appointment. Guests cannot use tele-consult (no account = no
// authenticated channel to receive the join link safely).
function canAccess(appt, user) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'clinician') return true;
  if (appt.patientId && String(appt.patientId) === String(user._id)) return true;
  return false;
}

const idParamSchema = z.object({ id: z.string().refine(isObjectId, 'invalid_id') });

router.post(
  '/:id/teleconsult',
  requireAuth,
  requireRole('admin', 'clinician'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const appt = await Appointment.findById(id);
    if (!appt) return res.status(404).json({ error: 'not_found' });
    if (!appt.patientId) return res.status(400).json({ error: 'guest_appointment_no_teleconsult' });

    // Reuse an existing room if one is already active so a refresh during
    // the call does not invalidate the patient's join link.
    if (!appt.teleconsult?.enabled || appt.teleconsult.endedAt) {
      const random = crypto.randomBytes(9).toString('base64url'); // 12 chars URL-safe
      appt.teleconsult = {
        enabled: true,
        provider: 'jitsi',
        roomName: `afya-${random}`,
        createdBy: req.user._id,
        createdAt: new Date(),
        joinedClinicianAt: new Date(),
      };
    } else {
      appt.teleconsult.joinedClinicianAt = appt.teleconsult.joinedClinicianAt || new Date();
    }
    await appt.save();

    try {
      getIo().to(`patient:${appt.patientId}`).emit('teleconsult:ready', {
        appointmentId: appt._id,
      });
    } catch { /* socket optional */ }

    res.status(201).json({ appointmentId: appt._id, teleconsult: joinPayload(appt) });
  })
);

router.get(
  '/:id/teleconsult',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const appt = await Appointment.findById(id);
    if (!appt) return res.status(404).json({ error: 'not_found' });
    if (!canAccess(appt, req.user)) return res.status(403).json({ error: 'forbidden' });

    const payload = joinPayload(appt);
    if (!payload) return res.status(404).json({ error: 'not_started' });

    // Mark the patient join time the first time they fetch the link.
    if (req.user.role === 'patient' && !appt.teleconsult.joinedPatientAt) {
      appt.teleconsult.joinedPatientAt = new Date();
      await appt.save();
    }
    res.json({ appointmentId: appt._id, teleconsult: payload });
  })
);

router.post(
  '/:id/teleconsult/end',
  requireAuth,
  requireRole('admin', 'clinician'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const appt = await Appointment.findById(id);
    if (!appt) return res.status(404).json({ error: 'not_found' });
    if (!appt.teleconsult?.enabled) return res.status(400).json({ error: 'not_started' });
    appt.teleconsult.endedAt = new Date();
    appt.teleconsult.enabled = false;
    await appt.save();
    try {
      getIo().to(`patient:${appt.patientId}`).emit('teleconsult:ended', {
        appointmentId: appt._id,
      });
    } catch { /* socket optional */ }
    res.json({ appointmentId: appt._id, endedAt: appt.teleconsult.endedAt });
  })
);

export default router;
