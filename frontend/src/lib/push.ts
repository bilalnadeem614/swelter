const BASE_URL = import.meta.env.VITE_API_BASE_URL
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

// desktop/Android only — iOS Safari only supports push for an installed home-screen PWA,
// which this app doesn't set up, so it's treated as unsupported there
export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration("/sw.js")
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

export async function enablePush(): Promise<void> {
  if (!isPushSupported()) throw new Error("Push notifications aren't supported in this browser")
  if (!VAPID_PUBLIC_KEY) throw new Error("Push isn't configured (missing VAPID public key)")

  const reg = await navigator.serviceWorker.register("/sw.js")
  const permission = await Notification.requestPermission()
  if (permission !== "granted") throw new Error("Notification permission denied")

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })
  const json = subscription.toJSON()

  const res = await fetch(`${BASE_URL}/api/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  })
  if (!res.ok) throw new Error(`push subscribe failed: ${res.status}`)
}
