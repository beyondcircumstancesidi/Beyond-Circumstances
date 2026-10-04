// Looks up an existing account by email using the service role key (server-side
// only — the public anon key is deliberately NOT allowed to read this table, so
// student data can't be scraped by anyone who inspects the client-side code).
// This is what lets a student "log back in" by re-entering their email instead
// of creating a duplicate blank account and losing their old progress.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Database is not configured yet.' });
  }

  const body = req.body || {};
  const email = (body.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const url =
    process.env.SUPABASE_URL +
    '/rest/v1/accounts?email=eq.' + encodeURIComponent(email) + '&select=*';

  try {
    const r = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
    if (!r.ok) {
      return res.status(502).json({ error: 'Could not reach the database.' });
    }
    const rows = await r.json();
    if (!rows.length) {
      return res.status(200).json({ found: false });
    }
    return res.status(200).json({ found: true, account: rows[0] });
  } catch (err) {
    console.error('resume-account error:', err);
    return res.status(502).json({ error: 'Could not reach the database.' });
  }
}
