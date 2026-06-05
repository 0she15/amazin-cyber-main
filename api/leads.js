// Vercel serverless function: POST /api/leads
// Public-facing — writes to Supabase `leads` table with the service role key
// (bypasses RLS). No user auth. Basic in-memory per-IP rate limiting.

const RATE_LIMIT = 5; // max submissions
const WINDOW_MS = 60 * 60 * 1000; // per hour
const hits = new Map(); // ip -> number[] (timestamps)

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Body may already be parsed by Vercel; fall back to manual parse.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const name = (body.name || '').toString().trim();
  const email = (body.email || '').toString().trim();
  if (!name || !email) {
    return res.status(400).json({ ok: false, error: 'Name and email are required.' });
  }

  if (rateLimited(clientIp(req))) {
    return res.status(429).json({ ok: false, error: 'Too many submissions. Please try again later.' });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('Missing Supabase env vars');
    return res.status(500).json({ ok: false, error: 'Server not configured.' });
  }

  const lead = {
    name,
    company: (body.company || '').toString().trim() || null,
    email,
    phone: (body.phone || '').toString().trim() || null,
    package: (body.package || '').toString().trim() || null,
    message: (body.message || '').toString().trim() || null,
    source: 'website',
    status: 'new',
  };

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(lead),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      console.error('Supabase insert failed:', resp.status, detail);
      return res.status(502).json({ ok: false, error: 'Could not save submission.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Lead insert error:', err);
    return res.status(500).json({ ok: false, error: 'Unexpected error.' });
  }
};
