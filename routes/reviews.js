// Review routes — create and fetch reviews
const express = require('express');
const jwt = require('jsonwebtoken');
const reviewsDb = require('../db/reviews');
const bookingsDb = require('../db/bookings');
const pool = require('../db/index');
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

// POST /api/reviews — create a review for a completed booking
router.post('/', requireAuth, async (req, res) => {
  try {
    const { booking_id, rating, comment } = req.body;
    if (!booking_id || !rating) {
      return res.status(400).json({ error: 'booking_id and rating required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be 1–5' });
    }
    if (comment && comment.trim().length < 10) {
      return res.status(400).json({ error: 'Comment must be at least 10 characters' });
    }

    // Verify the booking belongs to this user and is completed
    const booking = await bookingsDb.getBookingById(booking_id, req.userId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'completed') {
      return res.status(400).json({ error: 'Can only review completed bookings' });
    }

    // Check no duplicate review
    const existing = await reviewsDb.getReviewByBookingId(booking_id);
    if (existing) return res.status(400).json({ error: 'Review already submitted for this booking' });

    const review = await reviewsDb.createReview({
      bookingId: booking_id,
      userId: req.userId,
      professionalId: booking.professional_id,
      rating,
      comment: comment || null,
    });

    res.status(201).json({ review });
  } catch (err) {
    console.error('create review error:', err);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// GET /api/reviews/professional/:id — list reviews for a professional
// Query params: rating (1-5), search (text in comment)
router.get('/professional/:id', requireAuth, async (req, res) => {
  try {
    const { rating, search } = req.query;
    if (rating && (isNaN(rating) || rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'rating must be 1–5' });
    }
    const reviews = await reviewsDb.getReviewsForProfessional(req.params.id, { rating, search });
    const stats = await reviewsDb.getAverageRatingForProfessional(req.params.id);
    res.json({ reviews, avg_rating: stats.avg_rating, review_count: stats.review_count });
  } catch (err) {
    console.error('fetch reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// POST /api/reviews/:id/report — flag a review as inappropriate
router.post('/:id/report', requireAuth, async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id, 10);
    if (isNaN(reviewId)) return res.status(400).json({ error: 'Invalid review id' });

    const { reason } = req.body;
    const alreadyReported = await reviewsDb.hasUserReportedReview({ reviewId, userId: req.userId });
    if (alreadyReported) {
      return res.status(400).json({ error: 'Hai già segnalato questa recensione' });
    }

    const report = await reviewsDb.reportReview({ reviewId, reporterUserId: req.userId, reason });
    res.status(201).json({ reported: true, report });
  } catch (err) {
    console.error('report review error:', err);
    res.status(500).json({ error: 'Failed to report review' });
  }
});

module.exports = router;