/**
 * Firebase Cloud Messaging Service Worker
 * Handles push notifications when the app is in the background
 */

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
    apiKey: "AIzaSyBPyqvEzm4D0ldWo4vSWrUF1N6ALNZlJr4",
    authDomain: "factur-ai-cc6a6.firebaseapp.com",
    projectId: "factur-ai-cc6a6",
    storageBucket: "factur-ai-cc6a6.firebasestorage.app",
    messagingSenderId: "102965005584",
    appId: "1:102965005584:web:15ca372e4fee5b38dbe995",
    measurementId: "G-5H03VTZ649"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    
    const notificationTitle = payload.notification?.title || 'Mini Market';
    const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: payload.data?.tag || 'default',
        data: payload.data,
        // Actions for the notification
        actions: [
            {
                action: 'view',
                title: 'Ver'
            },
            {
                action: 'dismiss',
                title: 'Cerrar'
            }
        ]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification clicked:', event);
    
    event.notification.close();
    
    // Handle action clicks
    if (event.action === 'view') {
        // Open the app or specific page
        const urlToOpen = event.notification.data?.url || '/';
        
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then((clientList) => {
                    // If app is already open, focus it
                    for (const client of clientList) {
                        if (client.url.includes(self.location.origin) && 'focus' in client) {
                            client.focus();
                            client.navigate(urlToOpen);
                            return;
                        }
                    }
                    // Otherwise open a new window
                    if (clients.openWindow) {
                        return clients.openWindow(urlToOpen);
                    }
                })
        );
    }
});

