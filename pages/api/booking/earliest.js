import { bookingConfigured, BookingDbError, findEarliestAppointment } from '../../../lib/server/bookingDb';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Nem támogatott művelet.' });
  if (!bookingConfigured()) return res.status(503).json({ error: 'A foglalórendszer még nincs konfigurálva.' });
  const serviceId = req.query.service;
  if (typeof serviceId !== 'string' || !/^[a-z0-9][a-z0-9-]{1,60}$/.test(serviceId)) return res.status(400).json({ error: 'Érvénytelen paraméterek.' });
  try {
    const appointment = await findEarliestAppointment({ serviceId });
    return res.status(200).json({ appointment });
  } catch (error) {
    if (error instanceof BookingDbError && error.status === 400) return res.status(400).json({ error: 'Érvénytelen dátum vagy szolgáltatás.' });
    console.error('[booking/earliest]', error.code || error.message);
    return res.status(503).json({ error: 'Nem sikerült megtalálni a legkorábbi időpontot.' });
  }
}
