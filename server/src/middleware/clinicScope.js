// Helpers for the multi-clinic / RBAC story (Phase 3.1).
//
// Roles:
//   - patient        — books appointments, sees own data only.
//   - clinician      — clinical staff scoped to one clinic.
//   - clinic_admin   — manages a single clinic (their staff + dashboard).
//   - admin          — superadmin, sees every clinic.
//
// `clinicScopeFilter(req)` returns a Mongo filter fragment to apply to any
// query that should be limited to the caller's clinic. Superadmins get an
// empty filter (no scoping); clinic-scoped roles get { clinicId: <theirs> };
// clinic-scoped roles without a clinicId on their account get a filter
// that matches nothing (so a misconfigured account can't see anything).

export const CLINIC_SCOPED_ROLES = new Set(['clinician', 'clinic_admin']);

export function clinicScopeFilter(req) {
  if (!req.user) return { _impossible_: true };
  if (req.user.role === 'admin') return {};
  if (CLINIC_SCOPED_ROLES.has(req.user.role)) {
    if (!req.user.clinicId) return { _impossible_: true };
    return { clinicId: req.user.clinicId };
  }
  return { _impossible_: true };
}

// True when the caller is allowed to act on data belonging to `clinicId`.
// Superadmins always pass; scoped roles must match their assigned clinic.
export function canAccessClinic(req, clinicId) {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;
  if (!CLINIC_SCOPED_ROLES.has(req.user.role)) return false;
  if (!req.user.clinicId || !clinicId) return false;
  return String(req.user.clinicId) === String(clinicId);
}
