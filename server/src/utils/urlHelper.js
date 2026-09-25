export const getBaseUrl = (req = null) => {
  if (req && req.get) {
    const protocol = req.protocol || "http";
    const host = req.get("host");
    if (host) {
      return `${protocol}://${host}`;
    }
  }
  return process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
};

export const toAbsoluteUrl = (pathOrUrl, req = null) => {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://") || pathOrUrl.startsWith("data:")) {
    return pathOrUrl;
  }
  const baseUrl = getBaseUrl(req);
  const cleanPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${baseUrl}${cleanPath}`;
};

export const safeJsonParse = (value, fallback = value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
};
