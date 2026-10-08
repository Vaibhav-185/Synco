import { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;

// Converts a browser PushSubscription into the plain JSON the backend stores.
function subscriptionToJson(sub) {
  const raw = sub.toJSON();
  return {
    endpoint: raw.endpoint,
    expirationTime: raw.expirationTime || null,
    keys: raw.keys // { p256dh, auth }
  };
}

export default function EnableNotifications() {
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState('default');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false);
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const subscribeFlow = async () => {
    if (!supported) return;
    setBusy(true);
    setMsg('');
    try {
      // 1. Ask permission if still undecided
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== 'granted') {
          setMsg(perm === 'denied'
            ? 'Blocked — enable notifications for this site in your browser settings.'
            : 'Dismissed — you can enable them anytime.');
          setBusy(false);
          return;
        }
      }

      // 2. Register SW + fetch the server's public VAPID key
      const reg       = await navigator.serviceWorker.register('/sw.js');
      const vapidRes  = await axios.get(`${API}/notifications/vapid-public-key`);
      const publicKey = vapidRes.data.publicKey;

      // 3. Subscribe, converting the applicationServerKey properly
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // 4. Persist on the server
      await axios.post(`${API}/notifications/subscribe`, { subscription: subscriptionToJson(sub) });

      // 5. Prove end-to-end delivery with a test push
      try {
        await axios.post(`${API}/notifications/test`);
        setMsg('✅ Notifications enabled — check for a test notification!');
      } catch {
        setMsg('✅ Subscribed. (Test push could not be sent — it will arrive before your next class.)');
      }
    } catch (err) {
      const detail = err.response?.data?.message || err.message;
      setMsg('❌ ' + detail);
    }
    setBusy(false);
  };

  const unsubscribeFlow = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }
      await axios.delete(`${API}/notifications/subscribe`);
      setMsg('Notifications turned off.');
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || err.message));
    }
    setBusy(false);
  };

  if (!supported) {
    // Graceful degradation: invisible where push isn't available
    return null;
  }

  if (permission === 'denied') {
    return (
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        🔕 Notifications are blocked in your browser settings.
      </div>
    );
  }

  if (permission === 'granted') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn sm" onClick={unsubscribeFlow} disabled={busy}>
          {busy ? 'Working...' : '🔔 Turn off class alerts'}
        </button>
        {msg && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{msg}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button className="btn accent sm" onClick={subscribeFlow} disabled={busy}>
        {busy ? 'Enabling...' : '🔔 Enable class alerts'}
      </button>
      {msg && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{msg}</span>}
    </div>
  );
}

// VAPID keys are base64url; PushManager needs raw bytes.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}
