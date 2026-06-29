// firebase-messaging-sw.js
// Service Worker for LokalFinder push notifications.
// Lives at the repo root next to index.html. Handles notifications
// when the app is closed or in the background.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB3in82uQ_PaoZrDx_nS2OD-ud2LMVL0Pk",
  authDomain: "lokalfinder-ec57f.firebaseapp.com",
  databaseURL: "https://lokalfinder-ec57f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lokalfinder-ec57f",
  storageBucket: "lokalfinder-ec57f.firebasestorage.app",
  messagingSenderId: "776410420489",
  appId: "1:776410420489:web:a69a4a7ed50e6d095cafd8",
  measurementId: "G-3D9YQB42LN"
});

const messaging = firebase.messaging();

// Icon as inline SVG data URI — no external file needed, works on any path
const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%231A6B4A'/%3E%3Ctext y='68' x='50' font-size='55' text-anchor='middle'%3E%F0%9F%8F%A0%3C/text%3E%3C/svg%3E";

// Background message handler — fires when the app is not focused.
messaging.onBackgroundMessage(function(payload) {
  const n = payload.notification || {};
  const title = n.title || '🔔 LokalFinder';
  const options = {
    body: n.body || '',
    icon: ICON,
    tag: (payload.data && payload.data.orderId) || 'lf-notif',
    requireInteraction: true,
    data: payload.data || {}
  };
  return self.registration.showNotification(title, options);
});

// Tapping the notification focuses or opens the app.
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // Use the SW's own scope URL — this is always the correct base URL
  // regardless of whether it's GitHub Pages, custom domain, etc.
  const appUrl = self.registration.scope;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      // If the app is already open, focus it
      for (const client of list) {
        if (client.url.startsWith(appUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open it
      if (clients.openWindow) return clients.openWindow(appUrl);
    })
  );
});
