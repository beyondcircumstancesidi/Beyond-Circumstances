// Returns every account row for the admin panel. Protected two ways: the
// service role key (never sent to the browser) is the only thing that can
// read this table at all, and this endpoint additionally requires the admin
// code to be POSTed — so even someone who finds this URL can't pull student
// data without also knowing the code.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.ADMIN_CODE) {
    return res.status(500).json({ error: 'Admin panel is not fully configured yet.' });
  }

  const body = req.body || {};
  if (body.code !== process.env.ADMIN_CODE) {
    return res.status(401).json({ error: 'Invalid admin code.' });
  }

  // Explicitly excludes password_hash — never return it, even to the admin UI.
  const url = process.env.SUPABASE_URL +
    '/rest/v1/accounts?select=id,name,email,dob,phone,school,area,is_admin,build_data,created_at,updated_at&order=created_at.desc';

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
    return res.status(200).json({ accounts: rows });
  } catch (err) {
    console.error('admin-accounts error:', err);
    return res.status(502).json({ error: 'Could not reach the database.' });
  }
}
