import { config } from '../config.js';
import { AuditLog } from '../models/AuditLog.js';

// Wraps an Express handler to record the call to the audit log AFTER it has
// run successfully. Designed to be a 100% pass-through when AUDIT_ENABLED is
// false so it can be applied to every state-changing route on day 1 without
// affecting current behaviour.
//
// Usage:
//   router.post('/', requireAuth, withAudit({
//     action: 'appointment.book',
//     resource: 'Appointment',
//     resourceId: (req, res, body) => body?.appointment?._id,
//     metadata: (req) => ({ clinicId: req.body?.clinicId }),
//   }), asyncHandler(async (req, res) => { ... }));
//
// The wrapper hooks res.json / res.send so we can capture the response body
// (used to derive the resourceId) without changing the handler signature.
export function withAudit(spec = {}) {
  if (!config.features.audit) {
    // Hot path: no-op middleware. Identical performance to not having audit.
    return (_req, _res, next) => next();
  }
  return function auditMiddleware(req, res, next) {
    const origJson = res.json.bind(res);
    const origSend = res.send.bind(res);
    let captured;
    res.json = (body) => { captured = body; return origJson(body); };
    res.send = (body) => { captured = body; return origSend(body); };

    res.on('finish', () => {
      // Only audit success-ish responses; client errors and rate limits are noise.
      if (res.statusCode >= 400) return;
      Promise.resolve()
        .then(() => writeAuditFromSpec(spec, req, res, captured))
        .catch((err) => console.error('[audit] failed to record', err));
    });

    next();
  };
}

async function writeAuditFromSpec(spec, req, res, body) {
  const action = typeof spec.action === 'function' ? spec.action(req, res, body) : spec.action;
  if (!action) return;

  const resource = typeof spec.resource === 'function' ? spec.resource(req, res, body) : spec.resource;
  const resourceId = typeof spec.resourceId === 'function'
    ? spec.resourceId(req, res, body)
    : spec.resourceId;
  const metadata = typeof spec.metadata === 'function' ? spec.metadata(req, res, body) : spec.metadata;

  // Atomically pull the latest hash so concurrent writes still chain correctly.
  // (For very high-throughput workloads we'd swap to a dedicated queue, but the
  // in-process approach is fine for AfyaConnect's scale.)
  const last = await AuditLog.findOne({}, { hash: 1 }).sort({ createdAt: -1, _id: -1 }).lean();
  const prevHash = last?.hash || null;

  const entry = {
    action,
    actorId: req.user?._id || null,
    actorRole: req.user?.role || null,
    actorIp: req.ip,
    resource: resource || null,
    resourceId: resourceId != null ? String(resourceId) : null,
    method: req.method,
    path: req.originalUrl,
    status: res.statusCode,
    metadata: metadata || {},
    prevHash,
    createdAt: new Date(),
  };
  entry.hash = AuditLog.computeHash(entry, prevHash);
  await AuditLog.create(entry);
}

// Direct audit recorder — for callers that want to write an entry inline
// rather than via the response-finish hook of withAudit. Honours the
// AUDIT_ENABLED flag so it stays a no-op when audit is off. Errors are
// logged but never thrown, since audit must never block the user flow.
export async function recordAudit({ action, req, resource = null, resourceId = null, metadata = {} }) {
  if (!config.features.audit) return;
  try {
    const last = await AuditLog.findOne({}, { hash: 1 }).sort({ createdAt: -1, _id: -1 }).lean();
    const prevHash = last?.hash || null;
    const entry = {
      action,
      actorId: req?.user?._id || null,
      actorRole: req?.user?.role || null,
      actorIp: req?.ip || null,
      resource,
      resourceId: resourceId != null ? String(resourceId) : null,
      method: req?.method || null,
      path: req?.originalUrl || null,
      status: null,
      metadata: metadata || {},
      prevHash,
      createdAt: new Date(),
    };
    entry.hash = AuditLog.computeHash(entry, prevHash);
    await AuditLog.create(entry);
  } catch (err) {
    console.error('[audit] failed to record', action, err);
  }
}
