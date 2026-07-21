import { api } from './api';

function decodeBase64Url(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value.replace(/-/g, '+').replace(/_/g, '/')}${padding}`;
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

export async function enableWebPush(token) {
  if (!token || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser. Install Chatika as an app or use a current browser.');
  }

  const config = await api('/realtime/push-config', { token });
  if (!config.vapid_public_key) {
    throw new Error('Push notifications are not configured on this server yet. Add the VAPID keys in Render first.');
  }

  const permission = await window.Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(config.vapid_public_key)
    });
  }

  await api('/push/register-token', {
    method: 'POST',
    token,
    body: {
      platform: 'web',
      token: JSON.stringify(subscription),
      device_name: `${navigator.platform || 'Browser'} · ${navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop'}`
    }
  });

  return subscription;
}
