import { config } from '../config.js';

let messaging = null;

export async function initFcm() {
  if (!config.fcm.enabled) {
    console.log('[fcm] disabled (FCM_ENABLED=false). Push will be stubbed.');
    return;
  }
  try {
    const { initializeApp, applicationDefault, cert } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');
    const fs = await import('node:fs');
    let credential;
    if (config.fcm.credentialsPath && fs.existsSync(config.fcm.credentialsPath)) {
      const json = JSON.parse(fs.readFileSync(config.fcm.credentialsPath, 'utf8'));
      credential = cert(json);
    } else {
      credential = applicationDefault();
    }
    initializeApp({ credential });
    messaging = getMessaging();
    console.log('[fcm] initialized');
  } catch (err) {
    console.warn('[fcm] init failed, push will be stubbed:', err.message);
  }
}

export async function sendPush(tokens, payload) {
  const targets = (tokens || []).filter(Boolean);
  if (!messaging || targets.length === 0) {
    console.log(`[fcm:stub] would push to ${targets.length} tokens:`, payload?.notification?.title);
    return { stubbed: true, count: targets.length };
  }
  return messaging.sendEachForMulticast({ tokens: targets, ...payload });
}
