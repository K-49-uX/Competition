import { Router } from 'express';
import { Appointment } from '../models/Appointment.js';
import { Clinic } from '../models/Clinic.js';
import { QueueState } from '../models/QueueState.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getIo } from '../realtime/io.js';

const router = Router();

router.get(
  '/:clinicId',
  asyncHandler(async (req, res) => {
    const state = await QueueState.findOne({ clinicId: req.params.clinicId }).lean();
    const clinic = await Clinic.findById(req.params.clinicId).lean();
    if (!clinic) return res.status(404).json({ error: 'clinic_not_found' });

    // Count waiting appointments triaged as high or critical so the public
    // queue page can show "X urgent ahead" — gives clinicians cover when
    // urgent cases jump the queue and warns walk-ins to expect delays.
    const urgentWaiting = await Appointment.countDocuments({
      clinicId: clinic._id,
      status: 'waiting',
      'triage.severity': { $in: ['high', 'critical'] },
    });

    res.json({
      clinicId: clinic._id,
      currentlyServing: state?.currentlyServing || 0,
      lastIssued: state?.lastIssued || 0,
      urgentWaiting,
      avgServiceMinutes: clinic.avgServiceMinutes,
    });
  })
);

router.post(
  '/:clinicId/advance',
  requireAuth,
  requireRole('clinician', 'admin'),
  asyncHandler(async (req, res) => {
    const clinic = await Clinic.findById(req.params.clinicId);
    if (!clinic) return res.status(404).json({ error: 'clinic_not_found' });

    const state = await QueueState.findOneAndUpdate(
      { clinicId: clinic._id },
      { $inc: { currentlyServing: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // mark prior serving as completed, mark new ticket as serving
    await Appointment.updateMany(
      { clinicId: clinic._id, status: 'serving' },
      { status: 'completed' }
    );
    await Appointment.findOneAndUpdate(
      { clinicId: clinic._id, ticketNumber: state.currentlyServing, status: 'waiting' },
      { status: 'serving' }
    );

    const payload = {
      clinicId: clinic._id,
      currentlyServing: state.currentlyServing,
      lastIssued: state.lastIssued,
      avgServiceMinutes: clinic.avgServiceMinutes,
    };
    getIo().to(`clinic:${clinic._id}`).emit('queue:update', payload);
    res.json(payload);
  })
);

export default router;
