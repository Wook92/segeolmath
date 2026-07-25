const DEFAULT_FAVICON = "/default-favicon.png";
const R2_PUBLIC_URL_PREFIX = "https://pub-";

export function convertToProxyUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith(R2_PUBLIC_URL_PREFIX) && url.includes(".r2.dev/")) {
    const parts = url.split(".r2.dev/");
    if (parts.length === 2) {
      return `/api/r2-proxy/${parts[1]}`;
    }
  }
  return url;
}

export function addVersionQuery(url: string, version?: string | number): string {
  if (!url) return url;
  const v = version || Date.now();
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${v}`;
}

export function setFavicon(url: string | null | undefined, version?: string | number) {
  let faviconUrl = url || DEFAULT_FAVICON;
  
  if (faviconUrl !== DEFAULT_FAVICON) {
    faviconUrl = convertToProxyUrl(faviconUrl) || faviconUrl;
    faviconUrl = addVersionQuery(faviconUrl, version);
  }
  
  const link = document.getElementById("dynamic-favicon") as HTMLLinkElement;
  if (link) {
    link.href = faviconUrl;
  }
  const appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
  if (appleIcon) {
    appleIcon.href = faviconUrl;
  }
}

export function setFaviconFromCenter(center: { faviconUrl?: string | null; updatedAt?: Date | string | null } | null) {
  const version = center?.updatedAt ? new Date(center.updatedAt).getTime() : undefined;
  setFavicon(center?.faviconUrl, version);
}

export function updateManifestLink(centerId?: string, version?: string | number) {
  const v = version || Date.now();
  const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
  if (manifestLink) {
    let manifestUrl = `/api/manifest?v=${v}`;
    if (centerId) {
      manifestUrl += `&centerId=${centerId}`;
    }
    manifestLink.href = manifestUrl;
  }
}
