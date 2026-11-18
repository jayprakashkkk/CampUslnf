// CampUs PWA & Live Notification Service Worker
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Periodic background check & web push handlers
self.addEventListener('push', function(event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'CampUs Alert', body: event.data ? event.data.text() : 'New campus update' };
  }
  var title = data.title || 'CampUs Community 🔔';
  var options = {
    body: data.body || 'New message in Community Chat',
    icon: '/icons/campusfind-192.png',
    badge: '/icons/campusfind-192.png',
    vibrate: [200, 100, 200],
    tag: 'campus-push-' + Date.now(),
    renotify: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('periodicsync', function(event) {
  if (event.tag === 'campus-chat-sync') {
    event.waitUntil(
      fetch('/api/community-chat?_t=' + Date.now(), { cache: 'no-store' })
        .then(function(r) { return r.json(); })
        .then(function(items) {
          if (Array.isArray(items) && items.length > 0) {
            var last = items[items.length - 1];
            return self.registration.showNotification((last.displayName || last.username) + ' (Community Chat)', {
              body: last.message,
              icon: '/icons/campusfind-192.png',
              badge: '/icons/campusfind-192.png',
              tag: 'chat-' + last.id,
              renotify: true
            });
          }
        })
        .catch(function() {})
    );
  }
});
