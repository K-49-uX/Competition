import { describe, it, expect, vi } from 'vitest';
import { sendSms, sendBulkSms } from '../src/services/sms.js';

describe('sms adapter (stub mode)', () => {
  it('rejects missing to/body', async () => {
    const r = await sendSms({ to: '+254700000001', body: '' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('missing_to_or_body');
  });

  it('rejects invalid phone', async () => {
    const r = await sendSms({ to: 'not-a-phone', body: 'hi' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('invalid_phone');
  });

  it('logs and returns ok=true in stub mode', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const r = await sendSms({ to: '+254700000001', body: 'reminder body' });
    expect(r).toEqual({ provider: 'stub', ok: true });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('sendBulkSms processes each entry', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const out = await sendBulkSms([
      { to: '+254700000001', body: 'a' },
      { to: 'bad', body: 'b' },
      { to: '+254700000002', body: 'c' },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0].ok).toBe(true);
    expect(out[1].ok).toBe(false);
    expect(out[2].ok).toBe(true);
  });
});
