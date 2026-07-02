// FixGo Push Service Worker
// Handles push notifications and background sync triggers

const CACHE_NAME = 'fixgo-push-v1';

// Install — pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

// Activate — claim all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push event — display the notification
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'FixGo', body: event.data ? event.data.text() : '' };
  }

  const { title, body, icon, tag, data } = payload;

  const notificationOptions = {
    body: body || '',
    icon: icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: tag || 'fixgo-notification',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: data || {},
  };

  event.waitUntil(
    self.registration.showNotification(title || 'FixGo', notificationOptions)
  );
});

// Notification click — open/focus the app to the relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window first
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Message: allow the main app to trigger sync actions
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});