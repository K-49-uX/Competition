// Centralized async wrapper + error handler.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err, _req, res, _next) {
  if (err?.name === 'ZodError') {
    return res.status(400).json({ error: 'validation', details: err.issues });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'duplicate', keys: err.keyValue });
  }
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'server_error' });
}
