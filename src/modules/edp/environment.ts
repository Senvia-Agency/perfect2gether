function isEdpLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

export function isEdpUiHost(hostname: string): boolean {
  return hostname.trim().length > 0;
}

export function isEdpCaptureEnabled(hostname: string, flag: string | undefined): boolean {
  return isEdpLocalHost(hostname) && flag === "true";
}

export function isEdpUiAvailable(): boolean {
  return isEdpUiHost(window.location.hostname);
}

export function isEdpLocalCaptureAvailable(): boolean {
  return isEdpCaptureEnabled(window.location.hostname, import.meta.env.VITE_EDP_LOCAL_CAPTURE_ENABLED);
}
