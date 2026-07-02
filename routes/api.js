// API routes — professionals, bookings
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db/index');
const db = require('../db/users');
const professionalsDb = require('../db/professionals');
const bookingsDb = require('../db/bookings');
const { sendBookingEmails } = require('../lib/notifications');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fixgo-dev-secret-change-in-production';

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

const SERVICE_PRICE_RANGES = {
  carwash: { min: 25, max: 60 },
  idraulica: { min: 40, max: 200 },
  elettricista: { min: 45, max: 180 },
  altro: { min: 30, max: 150 },
};

function getAvailableSlots(dateStr) {
  const slots = [];
  for (let h = 9; h <= 18; h++) {
    const label = `${h}:00`;
    const iso = dateStr ? `${dateStr}T${h.toString().padStart(2, '0')}:00:00+02:00` : null;
    slots.push({ time: label, iso, available: true });
  }
  return slots;
}

// GET /api/professionals?service_type=carwash
router.get('/professionals', requireAuth, async (req, res) => {
  try {
    const { service_type } = req.query;
    let query = `
      SELECT p.*,
        COALESCE(AVG(r.rating), p.rating) AS rating,
        COUNT(r.id) AS review_count
      FROM professionals p
      LEFT JOIN reviews r ON r.professional_id = p.id
      WHERE p.verified = true
    `;
    const params = [];
    if (service_type) {
      query += ' AND p.service_type = $1';
      params.push(service_type);
    }
    query += ' GROUP BY p.id ORDER BY rating DESC';
    const r = await pool.query(query, params);
    res.json({ professionals: r.rows });
  } catch (err) {
    console.error('get professionals error:', err);
    res.status(500).json({ error: 'Failed to fetch professionals' });
  }
});

// GET /api/professionals/nearby?lat=&lng=&service=carwash&urgency=high
router.get('/professionals/nearby', requireAuth, async (req, res) => {
  try {
    const { lat, lng, service, urgency } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng query params required' });
    }
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json({ error: 'lat and lng must be numeric' });
    }

    const rows = await professionalsDb.getNearby({
      lat: parsedLat,
      lng: parsedLng,
      serviceType: service || null,
    });

    // Boost high-urgency by also returning cross-service verified pros within 10km
    let results = rows;
    if (urgency === 'high' && rows.length < 3) {
      const fallback = await professionalsDb.getNearby({
        lat: parsedLat,
        lng: parsedLng,
        serviceType: null,
        limit: 5,
      });
      const seen = new Set(rows.map(r => r.id));
      const extra = fallback.filter(r => !seen.has(r.id));
      results = [...rows, ...extra];
    }

    res.json({
      professionals: results.slice(0, 20),
      center: { lat: parsedLat, lng: parsedLng },
    });
  } catch (err) {
    console.error('nearby professionals error:', err);
    res.status(500).json({ error: 'Failed to fetch nearby professionals' });
  }
});

// GET /api/professionals/:id
router.get('/professionals/:id', requireAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM professionals WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const pro = r.rows[0];
    // Fetch reviews stats
    const stats = await pool.query(
      `SELECT COALESCE(AVG(rating), $1::numeric) as avg_rating, COUNT(*) as review_count FROM reviews WHERE professional_id = $2`,
      [pro.rating, req.params.id]
    );
    const reviews = await pool.query(
      `SELECT r.*, u.name as reviewer_name, b.service_type
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       JOIN bookings b ON r.booking_id = b.id
       WHERE r.professional_id = $1
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [req.params.id]
    );
    res.json({
      professional: { ...pro, avg_rating: stats.rows[0].avg_rating, review_count: parseInt(stats.rows[0].review_count) },
      reviews: reviews.rows
    });
  } catch (err) {
    console.error('fetch professional error:', err);
    res.status(500).json({ error: 'Failed to fetch professional' });
  }
});

// GET /api/bookings
router.get('/bookings', requireAuth, async (req, res) => {
  try {
    const bookings = await bookingsDb.getBookingsForUser(req.userId);
    res.json({ bookings });
  } catch (err) {
    console.error('fetch bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET /api/bookings/my — alias for /api/bookings (used from profile page)
router.get('/bookings/my', requireAuth, async (req, res) => {
  try {
    const bookings = await bookingsDb.getBookingsForUser(req.userId);
    res.json({ bookings });
  } catch (err) {
    console.error('fetch bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET /api/bookings/slots?date=YYYY-MM-DD&pro_id=123
// NOTE: must be registered BEFORE /bookings/:id or ':id' captures "slots"
router.get('/bookings/slots', requireAuth, async (req, res) => {
  const { date, pro_id } = req.query;
  if (!date) return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
  const slots = getAvailableSlots(date);
  res.json({ slots, date });
});

// GET /api/bookings/:id
router.get('/bookings/:id', requireAuth, async (req, res) => {
  try {
    const booking = await bookingsDb.getBookingById(req.params.id, req.userId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// POST /api/bookings — full booking flow with pro + time slot
router.post('/bookings', requireAuth, async (req, res) => {
  try {
    const { professional_id, service_type, scheduled_at, address, notes, price } = req.body;
    if (!service_type || !address) {
      return res.status(400).json({ error: 'service_type and address required' });
    }

    // Fetch pro details for notifications
    let proName = null, proPhone = null, proEmail = null;
    if (professional_id) {
      const proRows = await pool.query(
        'SELECT name, phone, email FROM professionals WHERE id = $1',
        [professional_id]
      );
      if (proRows.rows.length > 0) {
        proName = proRows.rows[0].name;
        proPhone = proRows.rows[0].phone;
        proEmail = proRows.rows[0].email;
      }
    }

    const booking = await bookingsDb.createBooking({
      userId: req.userId,
      professionalId: professional_id || null,
      professionalName: proName,
      professionalPhone: proPhone,
      serviceType: service_type,
      scheduledAt: scheduled_at || null,
      address: address,
      notes: notes || null,
      price: price || null,
    });

    // Send notification emails to user and pro
    const user = await db.getUserById(req.userId);
    if (user?.email) {
      sendBookingEmails({
        userEmail: user.email,
        userName: user.name,
        proEmail,
        proName,
        booking,
      }).catch(err => console.error('booking email error:', err.message));
    }

    res.status(201).json({ booking });
  } catch (err) {
    console.error('create booking error:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// POST /api/photo/analyze — OpenAI Vision analysis of a problem photo
router.post('/photo/analyze', requireAuth, async (req, res) => {
  try {
    const { image_base64 } = req.body;
    if (!image_base64) {
      return res.status(400).json({ error: 'image_base64 required' });
    }

    // Use OpenAI via the polsia proxy
    const openaiKey = process.env.OPENAI_API_KEY;
    const openaiBase = process.env.OPENAI_BASE_URL || 'https://polsia.com/ai/openai/v1';

    // Fallback used when no API key is configured or the AI call fails,
    // so the demo flow always completes.
    const buildDemoAnalysis = () => ({
      service_type: 'idraulica',
      service_name: 'Intervento idraulico',
      urgency: 'medium',
      severity: 'moderate',
      estimated_price_eur: 85,
      problem_description: 'Analisi automatica non disponibile: stima indicativa basata su interventi tipici.',
      recommendations: ['Chiudi il rubinetto generale se noti perdite attive', 'Scatta una foto ravvicinata del problema per il professionista'],
      confidence: 0.4,
      demo: true,
    });

    const respondWithAnalysis = async (analysis) => {
      const prosRes = await pool.query(
        'SELECT * FROM professionals WHERE verified = true ORDER BY rating DESC LIMIT 10'
      );
      const matchedPros = prosRes.rows.filter(p => p.service_type === analysis.service_type);
      const estimateId = `est_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      return res.json({
        analysis,
        matched_professionals: (matchedPros.length ? matchedPros : prosRes.rows).slice(0, 2),
        estimate_id: estimateId,
        price_range: {
          min: Math.round(analysis.estimated_price_eur * 0.7),
          max: Math.round(analysis.estimated_price_eur * 1.3)
        }
      });
    };

    if (!openaiKey) {
      console.warn('photo/analyze: OPENAI_API_KEY not set — returning demo analysis');
      return respondWithAnalysis(buildDemoAnalysis());
    }

    const analysisRes = await fetch(`${openaiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Sei un esperto diagnostico per servizi domestici a Milano. Analizza questa foto e rispondi SOLO con un JSON valido (nessun markdown, nessun testo extra) con questa struttura:

{
  "service_type": "carwash" | "idraulica" | "elettricista" | "altro",
  "service_name": "Nome del servizio in italiano",
  "urgency": "low" | "medium" | "high",
  "severity": "minor" | "moderate" | "major",
  "estimated_price_eur": 45,
  "problem_description": "Breve descrizione del problema identificato (max 120 caratteri)",
  "recommendations": ["raccomandazione 1", "raccomandazione 2"],
  "confidence": 0.85
}

Regole:
- service_type: scegli tra "carwash", "idraulica", "elettricista" o "altro"
- urgency: quanto è urgente (infiltrazione = high, lavaggio = low)
- severity: gravità visibile del danno
- estimated_price_eur: stima realistca in euro per il servizio a Milano
- confidence: 0.0-1.0 quanto sei sicuro della tua identificazione
- Se l'immagine non è chiara o non mostra un problema riconoscibile, usa "altro" e confidence basso`
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${image_base64}` }
            }
          ]
        }],
        max_tokens: 600
      })
    });

    if (!analysisRes.ok) {
      const errText = await analysisRes.text();
      console.error('OpenAI vision error:', errText);
      return respondWithAnalysis(buildDemoAnalysis());
    }

    const data = await analysisRes.json();
    const raw = data.choices?.[0]?.message?.content?.trim();

    let analysis;
    try {
      // Strip markdown code blocks if present
      const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      analysis = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse AI response:', raw);
      return respondWithAnalysis(buildDemoAnalysis());
    }

    return respondWithAnalysis(analysis);
  } catch (err) {
    console.error('photo analyze error:', err);
    res.status(500).json({ error: 'Photo analysis failed' });
  }
});

// PATCH /api/bookings/:id/cancel
router.patch('/bookings/:id/cancel', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.userId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

module.exports = router;