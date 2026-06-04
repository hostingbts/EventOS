/** @type {import('@vercel/node').VercelRequest} */
export default async function handler(req, res) {
  const base = process.env.API_URL || process.env.VITE_API_URL;
  const token = process.env.API_TOKEN || process.env.VITE_API_TOKEN;

  if (!base || !token) {
    res.status(500).json({ error: 'API_URL and API_TOKEN not configured on server' });
    return;
  }

  const action = req.query.action || 'list';
  const url = new URL(base);
  url.searchParams.set('action', action);
  url.searchParams.set('token', token);
  if (req.query.code) url.searchParams.set('code', String(req.query.code));
  if (req.query.rowId) url.searchParams.set('rowId', String(req.query.rowId));

  if (req.method === 'POST') {
    const upstream = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(typeof req.body === 'object' ? req.body : {}), token }),
    });
    const text = await upstream.text();
    res.status(upstream.status).setHeader('Content-Type', 'application/json');
    res.send(text);
    return;
  }

  const upstream = await fetch(url.toString());
  const text = await upstream.text();
  res.status(upstream.status).setHeader('Content-Type', 'application/json');
  res.send(text);
}
