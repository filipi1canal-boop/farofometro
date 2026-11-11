(function () {
  'use strict';
  const SEEN_KEY = 'ff_last_notification';
  let registration = null;

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(reg => { registration = reg; }).catch(() => {});
  }

  window.FFEnableNotifications = async function () {
    if (!('Notification' in window)) return { ok: false, reason: 'unsupported' };
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: permission };
    if (window.FF && window.FF.showToast) window.FF.showToast('Notificações ativadas!');
    return { ok: true };
  };

  function handleNotification() {
    if (!window.FF || !('Notification' in window) || Notification.permission !== 'granted') return;
    const n = window.FF.getState().notification;
    if (!n || !n.id || localStorage.getItem(SEEN_KEY) === n.id) return;
    localStorage.setItem(SEEN_KEY, n.id);
    if (registration && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'notification', notification: n });
    } else if (registration) {
      registration.showNotification(n.title || 'Farofômetro', { body: n.body || '', icon: 'icon.svg', data: { url: n.url || 'votar.html' } });
    } else {
      new Notification(n.title || 'Farofômetro', { body: n.body || '', icon: 'icon.svg' });
    }
  }

  window.addEventListener('storage', event => { if (event.key === 'farofometro_v4') handleNotification(); });
  window.addEventListener('ff:notification', handleNotification);
  window.addEventListener('ff:syncready', handleNotification);
  setTimeout(handleNotification, 4000);
})();
