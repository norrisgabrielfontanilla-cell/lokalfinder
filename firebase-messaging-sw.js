/**
 * LokalFinder Cloud Function — onOrderChange (v29)
 * Region: asia-southeast1 · Project: lokalfinder-ec57f
 *
 * PUSH STRATEGY (automatic, no-duplicate):
 *   • If OneSignal keys are set below → OneSignal handles the push
 *     (works on BOTH iOS and Android).
 *   • If OneSignal keys are empty      → falls back to the existing
 *     FCM behavior exactly as before (Android only).
 *   A given notification is sent through ONE channel, never both.
 *
 * SETUP:
 *   1. onesignal.com → your app → Settings → Keys & IDs
 *   2. Paste App ID and REST API Key below.
 *   3. Deploy:  firebase deploy --only functions
 *
 * This file REPLACES functions/index.js in your Firebase project.
 */

const { onValueWritten } = require("firebase-functions/v2/database");
const admin = require("firebase-admin");
admin.initializeApp();

// ▼▼▼ PASTE YOUR ONESIGNAL KEYS (leave empty to keep FCM-only behavior) ▼▼▼
const ONESIGNAL_APP_ID = "28b623cf-51df-4020-9a74-e40017f3c5bd";
const ONESIGNAL_API_KEY = "os_v2_app_fc3cht2r35acbgtu4qabp46fxv7abk3r7jjecdespcbj7iv6zgyqfw5cex7p2xp6aiccerm32vtzcb3g3sdcp4phpu5a7ikyaetti";
// ▲▲▲──────────────────────────────────────────────────────────────────▲▲▲

const ONESIGNAL_ON = !!(ONESIGNAL_APP_ID && ONESIGNAL_API_KEY);

// ── OneSignal REST helper ──────────────────────────────────────────────
async function osSend(payload) {
  const res = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: (ONESIGNAL_API_KEY.indexOf("os_v2_") === 0 ? "Key " : "Basic ") + ONESIGNAL_API_KEY,
    },
    body: JSON.stringify({ app_id: ONESIGNAL_APP_ID, target_channel: "push", ...payload }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors) {
    console.warn("[OneSignal] send issue:", res.status, JSON.stringify(body));
  } else {
    console.log("[OneSignal] sent:", body.id || JSON.stringify(body));
  }
  return body;
}

// Vendor push → targeted by external_id (set to vendorId at vendor login)
function osToVendor(vendorId, title, message, orderId) {
  return osSend({
    include_aliases: { external_id: [String(vendorId)] },
    headings: { en: title },
    contents: { en: message },
    web_push_topic: orderId || "lf-order",
    priority: 10,
  });
}

// Customer push → targeted by the subscription id snapshotted on the order
function osToSubscription(subId, title, message, orderId) {
  return osSend({
    include_subscription_ids: [String(subId)],
    headings: { en: title },
    contents: { en: message },
    web_push_topic: orderId || "lf-status",
    priority: 10,
  });
}

// ── FCM helpers (unchanged legacy behavior) ───────────────────────────
async function fcmToVendor(vendorId, title, body, orderId) {
  const snap = await admin
    .database()
    .ref(`/lokalfinder_grass/fcmTokens/vendors/${vendorId}`)
    .get();
  if (!snap.exists()) {
    console.log("[FCM] no vendor tokens for", vendorId);
    return;
  }
  const tokens = Object.values(snap.val() || {}).filter(Boolean);
  if (!tokens.length) return;
  const msg = {
    notification: { title, body },
    data: { orderId: String(orderId || "") },
    webpush: {
      headers: { Urgency: "high" },
      notification: { title, body, requireInteraction: true, tag: String(orderId || "lf") },
    },
  };
  const resp = await admin.messaging().sendEachForMulticast({ tokens, ...msg });
  console.log(`[FCM] vendor ${vendorId}: ${resp.successCount} ok / ${resp.failureCount} fail`);
  // prune dead tokens
  resp.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error && r.error.code;
      if (code === "messaging/registration-token-not-registered") {
        const bad = tokens[i].replace(/[^a-zA-Z0-9_-]/g, "").slice(-120);
        admin.database().ref(`/lokalfinder_grass/fcmTokens/vendors/${vendorId}/${bad}`).remove();
      }
    }
  });
}

async function fcmToCustomer(token, title, body, orderId) {
  if (!token) return;
  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: { orderId: String(orderId || "") },
      webpush: {
        headers: { Urgency: "high" },
        notification: { title, body, tag: String(orderId || "lf") },
      },
    });
    console.log("[FCM] customer push sent");
  } catch (e) {
    console.warn("[FCM] customer push failed:", e.message);
  }
}

// ── Status → friendly customer copy ───────────────────────────────────
const STATUS_COPY = {
  accepted:  ["Order accepted! 👨‍🍳", "Your neighbor is preparing your food."],
  preparing: ["Cooking now 🔥", "Your order is being prepared."],
  ready:     ["Order ready! 🛎️", "Your food is ready for pickup/delivery."],
  otw:       ["On the way 🚶", "Your order is heading to your unit."],
  delivered: ["Delivered! 🎉", "Enjoy your food. Salamat sa pag-order!"],
  declined:  ["Order declined 😔", "Sorry — the vendor can't take this order right now."],
};

// ── Main trigger ───────────────────────────────────────────────────────
exports.onOrderChange = onValueWritten(
  { ref: "/lokalfinder_grass/orders/{orderId}", region: "asia-southeast1" },
  async (event) => {
    const before = event.data.before.val();
    const after = event.data.after.val();
    if (!after) return; // deletion

    const orderId = event.params.orderId;

    // ── NEW ORDER → notify the vendor ──
    if (!before) {
      const vendorId = after.vendorId;
      if (!vendorId) return;
      const title = "🔔 New Order — LokalFinder";
      const body = `${after.name || "Customer"} · Unit ${after.unit || "?"} · ₱${after.total || 0} · ${after.method === "gcash" ? "GCash" : "Cash"}`;
      if (ONESIGNAL_ON) {
        await osToVendor(vendorId, title, body, orderId);
      } else {
        await fcmToVendor(vendorId, title, body, orderId);
      }
      return;
    }

    // ── STATUS CHANGE → notify the customer ──
    if (before.status !== after.status && STATUS_COPY[after.status]) {
      const [title, body] = STATUS_COPY[after.status];
      if (ONESIGNAL_ON && after.onesignalSubId) {
        await osToSubscription(after.onesignalSubId, title, body, orderId);
      } else if (after.customerFcmToken) {
        await fcmToCustomer(after.customerFcmToken, title, body, orderId);
      } else {
        console.log("[push] no customer channel on order", orderId);
      }
    }
  }
);
