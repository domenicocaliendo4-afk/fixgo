/**
 * Client-side analytics tracking utility.
 * Fire-and-forget POST to /api/analytics — never blocks the UX.
 */
const ANALYTICS_EVENTS = {
  // Onboarding funnel
  page_view_home: 'page_view_home',
  page_view_map: 'page_view_map',
  page_view_professional_detail: 'page_view_professional_detail',
  page_view_booking: 'page_view_booking',
  page_view_booking_confirm: 'page_view_booking_confirm',
  page_view_verification: 'page_view_verification',
  page_view_payment_success: 'page_view_payment_success',

  // Booking actions
  booking_created: 'booking_created',
  booking_step_date: 'booking_step_date',
  booking_step_time: 'booking_step_time',
  booking_step_address: 'booking_step_address',
  booking_step_confirm: 'booking_step_confirm',
  payment_initiated: 'payment_initiated',
  payment_success: 'payment_success',

  // Auth
  register_completed: 'register_completed',
  login_completed: 'login_completed',

  // Verification (pro)
  verification_started: 'verification_started',
  verification_completed: 'verification_completed',
};

function track(name, metadata = {}) {
  if (!Object.values(ANALYTICS_EVENTS).includes(name)) {
    console.warn('[analytics] Unknown event:', name);
  }
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, metadata }),
  }).catch(() => {
    // Never surface errors to the user — analytics is non-critical
  });
}

module.exports = { track, ANALYTICS_EVENTS };