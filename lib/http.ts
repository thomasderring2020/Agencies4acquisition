/**
 * Wraps a route handler so unexpected failures come back as readable JSON
 * ({ error: "..." }) instead of a bare 500, and are logged to Vercel's runtime logs.
 */
export function safe<A extends unknown[]>(name: string, fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      const err = e as Error;
      console.error(`[${name}]`, err);
      return Response.json({ error: friendly(err) }, { status: 500 });
    }
  };
}

function friendly(err: Error): string {
  const m = String(err?.message || err);
  if (/WRONGPASS|unauthorized|invalid.*token|NOAUTH/i.test(m))
    return "The database rejected the token. Re-copy the Upstash REST token into Vercel and redeploy.";
  if (/fetch failed|ENOTFOUND|getaddrinfo|Failed to parse URL|Invalid URL/i.test(m))
    return "Couldn't reach the database. Check the Upstash REST URL in Vercel (it should start with https://) and redeploy.";
  if (/EROFS|read-only file system|EACCES/i.test(m))
    return "No database is connected, so nothing can be saved. Connect Upstash Redis in Vercel and redeploy.";
  return m.slice(0, 300);
}
