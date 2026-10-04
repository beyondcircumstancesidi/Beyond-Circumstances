// Verifies email + password against the stored hash. Runs server-side with
// the service role key - the public anon key can't read this table at all,
// so there's no way to check a password from the browser directly.

import crypto from 'crypto';

function verifyPassword(password, stored) {
  if (!stored || stored.indexOf(':') === -1) return false;
  const [salt, hash] = stored.split(':');
  const hashBuffer = Buffer.from(hash, 'hex');
  const suppliedBuffer = crypto.scryptSync(password, salt, 64);
  return hashBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(hashBuffer, suppliedBuffer);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Database is not configured yet.' });
  }

  const body = req.body || {};
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Enter your email and password.' });
  }

  const url = process.env.SUPABASE_URL + '/rest/v1/accounts?email=eq.' + encodeURIComponent(email) + '&select=*';

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
    if (!rows.length || !verifyPassword(password, rows[0].password_hash)) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    const account = rows[0];
    delete account.password_hash;
    return res.status(200).json({ account });
  } catch (err) {
    console.error('login error:', err);
    return res.status(502).json({ error: 'Could not reach the database.' });
  }
}
