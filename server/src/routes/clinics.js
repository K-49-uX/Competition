import { Router } from 'express';
import { z } from 'zod';
import { Clinic } from '../models/Clinic.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const clinics = await Clinic.find().lean();
    res.json({ clinics });
  })
);

router.get(
  '/near',
  asyncHandler(async (req, res) => {
    const lng = Number(req.query.lng);
    const lat = Number(req.query.lat);
    const maxKm = Number(req.query.maxKm) || 50;
    if (Number.isNaN(lng) || Number.isNaN(lat)) {
      return res.status(400).json({ error: 'lng and lat required' });
    }
    const clinics = await Clinic.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: maxKm * 1000,
        },
      },
    }).lean();
    res.json({ clinics });
  })
);

const upsertSchema = z.object({
  name: z.string(),
  address: z.string().optional(),
  services: z.array(z.string()).optional(),
  hours: z.string().optional(),
  avgServiceMinutes: z.number().optional(),
  lng: z.number(),
  lat: z.number(),
});

router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = upsertSchema.parse(req.body);
    const clinic = await Clinic.create({
      name: data.name,
      address: data.address,
      services: data.services || [],
      hours: data.hours,
      avgServiceMinutes: data.avgServiceMinutes,
      location: { type: 'Point', coordinates: [data.lng, data.lat] },
    });
    res.status(201).json({ clinic });
  })
);

export default router;
