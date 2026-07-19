// firebase-messaging-sw.js — LokalFinder background push worker
// This file MUST live at the repo root, next to index.html.
// It runs in the background (even when the app is closed) and shows
// the notification on the phone's screen with sound.

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

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

// Fires when a push arrives and the app is closed or in the background.
messaging.onBackgroundMessage(function (payload) {
  const title = (payload.notification && payload.notification.title) || "LokalFinder";
  const body = (payload.notification && payload.notification.body) || "You have a new order.";

  self.registration.showNotification(title, {
    body: body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200],
    tag: (payload.data && payload.data.orderId) || "lf-order",
    requireInteraction: true,
    data: payload.data || {}
  });
});

// When the vendor taps the notification, open/focus the app.
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
