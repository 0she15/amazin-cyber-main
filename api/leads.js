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

const FROM_EMAIL = 'Amazin Cyber <support@amazincyber.com>';
const NOTIFY_EMAIL = 'oshe@amazincyber.com';

// Send a plain-text email via Resend. Throws on failure (callers swallow it
// so a failed email never blocks the lead from being saved).
async function sendEmail({ to, subject, text, replyTo }) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    console.log(`[email skipped — no RESEND_API_KEY] to=${to} subject=${subject}`);
    return;
  }
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      text,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.message || `Resend error ${resp.status}`);
  }
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

    // Lead saved. Fire confirmation + internal notification emails.
    // A failed email must NOT block the success response.
    const confirmationText = `Hi ${name},

Thanks for reaching out. I received your request and will follow up within 1-2 business days to schedule a brief call.

In the meantime, if you have any questions you can reply to this email.

— Oshé
Founder, Amazin Cyber
amazincyber.com`;

    const notificationText = `New lead submitted via amazincyber.com

Name: ${lead.name}
Company: ${lead.company || '—'}
Email: ${lead.email}
Phone: ${lead.phone || '—'}
Package: ${lead.package || '—'}
Message: ${lead.message || '—'}
Source: ${lead.source}
Status: ${lead.status}`;

    try {
      await sendEmail({
        to: email,
        subject: 'We received your request — Amazin Cyber',
        text: confirmationText,
      });
    } catch (e) {
      console.error('Confirmation email failed (lead still saved):', e);
    }

    try {
      await sendEmail({
        to: NOTIFY_EMAIL,
        subject: `New lead: ${name} — ${lead.company || 'No company'}`,
        text: notificationText,
        replyTo: email,
      });
    } catch (e) {
      console.error('Notification email failed (lead still saved):', e);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Lead insert error:', err);
    return res.status(500).json({ ok: false, error: 'Unexpected error.' });
  }
};
