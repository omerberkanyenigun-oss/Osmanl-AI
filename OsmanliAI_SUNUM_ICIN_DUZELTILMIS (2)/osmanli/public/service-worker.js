// V29.1: Eski hatalı service worker kayıtlarını güvenli biçimde kaldırır.
self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) client.navigate(client.url);
    } catch (error) {
      console.warn("Service worker temizliği başarısız:", error);
    }
  })());
});

// Fetch olayına müdahale edilmez; bütün cevapları doğrudan yerel sunucu verir.
