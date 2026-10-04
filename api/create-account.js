// Creates a new account with a securely hashed password. Runs entirely
// server-side (service role key) so the password hash is never exposed to
// or computed by the browser - the client only ever sends the raw password
// over HTTPS, same as any normal login form.

import crypto from 'crypto';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Database is not configured yet.' });
  }

  const body = req.body || {};
  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const dob = body.dob || null;
  const phone = (body.phone || '').trim();
  const school = (body.school || '').trim();
  const area = (body.area || '').trim();

  if (!name || !email || !password || !dob || !school || !area) {
    return res.status(400).json({ error: 'Please fill in every required field.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const passwordHash = hashPassword(password);

  try {
    const r = await fetch(process.env.SUPABASE_URL + '/rest/v1/accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        name, email, dob, phone, school, area, password_hash: passwordHash,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      const msg = (data && (data.message || data.error)) || '';
      if (/duplicate|unique/i.test(msg)) {
        return res.status(409).json({ error: 'An account with this email already exists — use the Log in tab instead.' });
      }
      console.error('create-account insert failed:', data);
      return res.status(502).json({ error: 'Could not create the account.' });
    }
    const account = data[0];
    delete account.password_hash;
    return res.status(200).json({ account });
  } catch (err) {
    console.error('create-account error:', err);
    return res.status(502).json({ error: 'Could not reach the database.' });
  }
}
