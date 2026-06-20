// Service Worker for Firebase Cloud Messaging
// Upload this file to your Netlify root directory (same level as your HTML)
// File name: firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Firebase config — will be initialized from the main app
// The main HTML file sends the config via postMessage
let firebaseConfig = null;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'INIT_FIREBASE') {
    firebaseConfig = event.data.config;
    firebase.initializeApp(firebaseConfig);
  }
});

// Initialize Firebase (fallback if postMessage doesn't work)
firebase.initializeApp({
  apiKey: "AIzaSyD...", // Will be overridden by main app
  authDomain: "grass-finder.firebaseapp.com",
  projectId: "grass-finder",
  storageBucket: "grass-finder.appspot.com",
  messagingSenderId: "...", // Will be set by main app
  appId: "1:...:web:..."
});

const messaging = firebase.messaging();

// Handle background messages (app is closed)
messaging.onBackgroundMessage((payload) => {
  console.log('🔔 Background message received:', payload);
  
  const notificationTitle = payload.data.title || 'LokalFinder';
  const notificationOptions = {
    body: payload.data.body || 'You have a new notification',
    icon: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 rx=%2222%22 fill=%22%231A6B4A%22/%3E%3Ctext y=%2268%22 x=%2250%22 font-size=%2255%22 text-anchor=%22middle%22%3E%F0%9F%8F%A0%3C/text%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 rx=%2222%22 fill=%22%231A6B4A%22/%3E%3Ctext y=%2268%22 x=%2250%22 font-size=%2255%22 text-anchor=%22middle%22%3E%F0%9F%8F%A0%3C/text%3E%3C/svg%3E',
    tag: payload.data.tag || 'order-notification',
    requireInteraction: true, // Keep notification until user dismisses
    data: {
      orderId: payload.data.orderId || null,
      url: '/',
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('📱 Notification clicked:', event.notification.data);
  event.notification.close();

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
