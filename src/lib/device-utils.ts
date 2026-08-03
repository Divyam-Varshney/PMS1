// ============================================================================
// File: src/lib/device-utils.ts
// Purpose: Browser-side utilities for the Device Registration Wizard.
//          Generates a stable per-browser device ID, parses the User-Agent
//          into a human-readable device label, and exposes helpers to check
//          whether THIS device is registered for push notifications.
//
//  Device ID strategy:
//    • A UUID v4 is generated once per browser and stored in localStorage
//      under PMS_DEVICE_ID_KEY. It persists across sessions + reloads.
//    • Clearing browser data wipes it (treated as a "new device" — correct).
//    • Private/incognito mode has its own storage (also correct — the
//      wizard will re-appear, but no row is persisted server-side until
//      the customer logs in).
//
//  Device label:
//    • Parsed from navigator.userAgent into "{Browser} · {OS}" format.
//    • Examples: "Chrome · Windows", "Safari · macOS", "Chrome · Android",
//      "Edge · iOS", "PWA · Android".
//    • deviceType is one of: desktop | mobile | tablet | pwa.
// ============================================================================

export const PMS_DEVICE_ID_KEY = "pms_device_id";
export const PMS_DEVICE_REG_VERSION = 1; // bump if storage format changes

export interface DeviceInfo {
  deviceId: string;
  deviceLabel: string;
  browserName: string;
  osName: string;
  deviceType: "desktop" | "mobile" | "tablet" | "pwa";
  userAgent: string;
}

/** Returns the device ID for THIS browser, generating one if missing. */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(PMS_DEVICE_ID_KEY);
    if (!id) {
      id = generateUuid();
      localStorage.setItem(PMS_DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return generateUuid();
  }
}

/** Parse the User-Agent into a structured DeviceInfo object. */
export function getDeviceInfo(): DeviceInfo {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  const deviceId = getOrCreateDeviceId();
  const browserName = detectBrowser(ua);
  const osName = detectOS(ua);
  const isPWA = detectPWA();
  const deviceType = isPWA ? "pwa" : detectDeviceType(ua);
  const deviceLabel = isPWA
    ? `PWA · ${osName}`
    : `${browserName} · ${osName}`;
  return { deviceId, deviceLabel, browserName, osName, deviceType, userAgent: ua };
}

// ---------------------------------------------------------------------------
// Detectors — kept simple and defensive. UA strings are unreliable; we prefer
// to fall back to "Other" rather than misidentify.
// ---------------------------------------------------------------------------

function detectBrowser(ua: string): string {
  // Order matters — some browsers spoof others.
  if (/edg/i.test(ua)) return "Edge";
  if (/opr|opera/i.test(ua)) return "Opera";
  if (/samsungbrowser/i.test(ua)) return "Samsung Internet";
  if (/chrome|crios|chromium/i.test(ua)) return "Chrome";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  return "Other";
}

function detectOS(ua: string): string {
  const lower = ua.toLowerCase();
  if (/windows nt 10/.test(lower)) return "Windows";
  if (/windows nt/.test(lower)) return "Windows";
  if (/android/.test(lower)) return "Android";
  if (/iphone|ipad|ipod/.test(lower)) return "iOS";
  if (/mac os x/.test(lower)) return "macOS";
  if (/linux/.test(lower)) return "Linux";
  if (/cros/.test(lower)) return "ChromeOS";
  return "Other";
}

function detectDeviceType(ua: string): "desktop" | "mobile" | "tablet" {
  const lower = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(lower)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile|windows phone/.test(lower)) return "mobile";
  return "desktop";
}

function detectPWA(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari standalone
  if ((window.navigator as any).standalone === true) return true;
  // Android Chrome display-mode: standalone
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }
  return false;
}

/** RFC4122 v4 UUID generator (crypto-backed where available). */
function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for very old browsers.
  const s = (n: number) =>
    Math.floor(Math.random() * Math.pow(2, n * 8))
      .toString(16)
      .padStart(n * 2, "0");
  return `${s(4)}-${s(2)}-4${s(1).substring(1)}-a${s(1).substring(1)}-${s(6)}`;
}
