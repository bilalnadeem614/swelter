// Web push service worker — desktop/Android only (iOS Safari needs an installed PWA, out of
// scope for this build). No caching/offline logic here, this exists solely to receive push
// events while the site isn't open in a tab.
self.addEventListener("push", (event) => {
  let data = { title: "Swelter", body: "" }
  try {
    if (event.data) data = event.data.json()
  } catch {
    // ignore malformed payloads
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Swelter", {
      body: data.body || "",
      icon: "/favicon.svg",
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(self.clients.openWindow("/"))
})
