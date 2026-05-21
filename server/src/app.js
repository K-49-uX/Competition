// Express app factory. Split out from index.js so tests (supertest) can
// import the app without starting the HTTP server, opening sockets, or
// kicking off cron jobs.
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import swaggerUi from 'swagger-ui-express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { openapiSpec } from './openapi.js';

import authRouter from './routes/auth.js';
import clinicsRouter from './routes/clinics.js';
import appointmentsRouter from './routes/appointments.js';
import queueRouter from './routes/queue.js';
import educationRouter from './routes/education.js';
import sosRouter from './routes/sos.js';
import notificationsRouter from './routes/notifications.js';
import usersRouter from './routes/users.js';
import metricsRouter from './routes/metrics.js';
import donationsRouter from './routes/donations.js';
import transparencyRouter from './routes/transparency.js';
import testimonialsRouter from './routes/testimonials.js';
import patientsRouter from './routes/patients.js';
import teleconsultRouter from './routes/teleconsult.js';
import prescriptionsRouter from './routes/prescriptions.js';
import adminRouter from './routes/admin.js';
import onboardingRouter from './routes/onboarding.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.disable('etag');

  // CSP is disabled because we serve a Vite SPA from the same origin which
  // needs blob:, data:, external map tiles (OpenStreetMap), and the Jitsi
  // iframe. The other Helmet protections stay on.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(mongoSanitize());
  // Quieter logs during automated tests; keep dev/prod logging untouched.
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  if (config.features.docs) {
    app.get('/api/docs.json', (_req, res) => res.json(openapiSpec));
    app.use(
      '/api/docs',
      swaggerUi.serve,
      swaggerUi.setup(openapiSpec, {
        customSiteTitle: 'AfyaConnect API',
        swaggerOptions: { persistAuthorization: true },
      })
    );
  }

  app.use('/api/auth', authRouter);
  app.use('/api/clinics', clinicsRouter);
  app.use('/api/appointments', appointmentsRouter);
  app.use('/api/queue', queueRouter);
  app.use('/api/education', educationRouter);
  app.use('/api/sos', sosRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/metrics', metricsRouter);
  if (config.features.donations) app.use('/api/donations', donationsRouter);
  if (config.features.transparency) app.use('/api/transparency', transparencyRouter);
  if (config.features.testimonials) app.use('/api/testimonials', testimonialsRouter);
  if (config.features.patientRecord) app.use('/api/patients', patientsRouter);
  if (config.features.teleconsult) app.use('/api/appointments', teleconsultRouter);
  if (config.features.prescriptions) app.use('/api/prescriptions', prescriptionsRouter);
  app.use('/api/admin', adminRouter);
  // Phase 3.5 — self-onboarding. Mounts both public (/api/onboarding/*) and
  // admin-gated (/api/onboarding/admin/*) routes from a single router.
  app.use('/api/onboarding', onboardingRouter);

  // 404 for unmatched API routes. Non-API requests fall through to the SPA
  // handler below.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

  // Serve the built React client (single-service deploy on Render).
  // The client is built into client/dist; we resolve relative to this file
  // so it works whether the server is started from repo root or server/.
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    // Dev mode: client is served by Vite on :5173. Nothing to do.
    app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  }

  app.use(errorHandler);
  return app;
}
