const windowMs = 10 * 60 * 1000;
const limit = 5;
const requests = new Map<string, { count: number; expires: number }>();

/** Best-effort per-process limit; serverless instances do not share this map. */
export function checkRateLimit(ip: string, now = Date.now()) {
  for (const [key, value] of requests) if (value.expires <= now) requests.delete(key);
  const current = requests.get(ip);
  if (current && current.count >= limit) return { allowed: false, retryAfter: Math.ceil((current.expires - now) / 1000) };
  if (current) current.count++;
  else {
    if (requests.size >= 10000) return { allowed: false, retryAfter: 60 };
    requests.set(ip, { count: 1, expires: now + windowMs });
  }
  return { allowed: true, retryAfter: 0 };
}
