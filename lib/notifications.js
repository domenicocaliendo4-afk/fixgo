/**
 * Notifications — email to user and pro on booking events.
 * Uses Polsia email proxy (no SendGrid needed).
 * Does NOT own: SMS (Twilio integration is separate concern).
 */
const EMAIL_PROXY = 'https://polsia.com/api/proxy/email';
const SERVICE_LABELS = {
  carwash: 'Car Wash a domicilio',
  idraulica: 'Idraulica',
  elettricista: 'Elettricista',
  pulizie: 'Pulizie domestiche',
  altro: 'Altro',
};

function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

async function sendBookingEmails({ userEmail, userName, proEmail, proName, booking }) {

  const serviceLabel = SERVICE_LABELS[booking.service_type] || booking.service_type;
  const formattedDate = formatDate(booking.scheduled_at);
  const priceStr = booking.price ? `€${parseFloat(booking.price).toFixed(2)}` : 'da definire';
  const bookingId = booking.id || booking.booking_id || '—';

  // Email to USER
  const userSubject = `✅ Prenotazione FixGo confermata — ${formattedDate}`;
  const userBody = `
Ciao ${userName},

La tua prenotazione è stata confermata! Ecco i dettagli:

📋 Prenotazione #${bookingId}
🔧 Servizio: ${serviceLabel}
📍 Indirizzo: ${booking.address}
📅 Data: ${formattedDate}
💰 Prezzo stimato: ${priceStr}
${booking.professional_name ? `👷 Professionista: ${booking.professional_name}` : ''}
${booking.notes ? `📝 Note: ${booking.notes}` : ''}

Riceverai un SMS/email di reminder prima dell'appuntamento.

— Il team FixGo
  `.trim();

  const userHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#2563EB;border-bottom:2px solid #2563EB;padding-bottom:8px">Prenotazione confermata!</h2>
  <p>Ciao <strong>${userName}</strong>,</p>
  <p>La tua prenotazione è stata confermata. Ecco i dettagli:</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0">
    <tr><td style="padding:8px 0;font-weight:bold;color:#64748B">Prenotazione</td><td style="padding:8px 0">#${bookingId}</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold;color:#64748B">Servizio</td><td style="padding:8px 0">${serviceLabel}</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold;color:#64748B">Indirizzo</td><td style="padding:8px 0">${booking.address}</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold;color:#64748B">Data e ora</td><td style="padding:8px 0">${formattedDate}</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold;color:#64748B">Prezzo stimato</td><td style="padding:8px 0;font-weight:bold;color:#15803D">${priceStr}</td></tr>
    ${booking.professional_name ? `<tr><td style="padding:8px 0;font-weight:bold;color:#64748B">Professionista</td><td style="padding:8px 0">${booking.professional_name}</td></tr>` : ''}
    ${booking.notes ? `<tr><td style="padding:8px 0;font-weight:bold;color:#64748B">Note</td><td style="padding:8px 0">${booking.notes}</td></tr>` : ''}
  </table>
  <p style="color:#64748B;font-size:13px">Riceverai un reminder prima dell'appuntamento.</p>
  <p style="margin-top:24px">— <strong>Il team FixGo</strong></p>
</div>`;

  // Email to PRO
  const proSubject = `🔔 Nuova prenotazione FixGo — ${formattedDate}`;
  const proBody = `
Ciao ${proName || 'Professionista'},

Hai ricevuto una nuova prenotazione:

📋 Prenotazione #${bookingId}
🔧 Servizio: ${serviceLabel}
📍 Indirizzo: ${booking.address}
📅 Data: ${formattedDate}
💰 Prezzo stimato: ${priceStr}
${userName ? `👤 Cliente: ${userName}` : ''}
${booking.notes ? `📝 Note: ${booking.notes}` : ''}

Accedi alla tua dashboard FixGo per confermare o contattare il cliente.

— FixGo
  `.trim();

  const proHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#2563EB;border-bottom:2px solid #2563EB;padding-bottom:8px">Nuova prenotazione!</h2>
  <p>Hai ricevuto una nuova richiesta di servizio:</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0">
    <tr><td style="padding:8px 0;font-weight:bold;color:#64748B">Prenotazione</td><td style="padding:8px 0">#${bookingId}</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold;color:#64748B">Servizio</td><td style="padding:8px 0">${serviceLabel}</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold;color:#64748B">Indirizzo</td><td style="padding:8px 0">${booking.address}</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold;color:#64748B">Data e ora</td><td style="padding:8px 0">${formattedDate}</td></tr>
    ${userName ? `<tr><td style="padding:8px 0;font-weight:bold;color:#64748B">Cliente</td><td style="padding:8px 0">${userName}</td></tr>` : ''}
    ${booking.notes ? `<tr><td style="padding:8px 0;font-weight:bold;color:#64748B">Note</td><td style="padding:8px 0">${booking.notes}</td></tr>` : ''}
  </table>
</div>`;

  // Send both emails in parallel via Polsia proxy
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.POLSIA_API_KEY}`,
  };

  const results = [];

  if (userEmail) {
    try {
      const res = await fetch(`${EMAIL_PROXY}/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ to: userEmail, subject: userSubject, body: userBody, html: userHtml }),
      });
      if (res.ok) {
        console.log('[notifications] User email sent to:', userEmail);
      } else {
        const err = await res.text();
        console.error('[notifications] User email failed:', err);
      }
    } catch (err) {
      console.error('[notifications] User email error:', err.message);
    }
    results.push({ type: 'user', email: userEmail, success: true });
  }

  if (proEmail) {
    try {
      const res = await fetch(`${EMAIL_PROXY}/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ to: proEmail, subject: proSubject, body: proBody, html: proHtml }),
      });
      if (res.ok) {
        console.log('[notifications] Pro email sent to:', proEmail);
      } else {
        const err = await res.text();
        console.error('[notifications] Pro email failed:', err);
      }
    } catch (err) {
      console.error('[notifications] Pro email error:', err.message);
    }
    results.push({ type: 'pro', email: proEmail, success: true });
  }

  return results;
}

async function sendProVerifiedEmail(pro) {
  const EMAIL_PROXY = 'https://polsia.com/api/proxy/email';
  const to = process.env.ADMIN_EMAIL || 'drift@polsia.app';
  const subject = `Nuovo professionista verificato su FixGo: ${pro.name || 'Sconosciuto'} — ${pro.service_type || ''}`;
  const body = `
Nuovo professionista verificato su FixGo:

Nome: ${pro.name || 'N/D'}
Servizio: ${pro.service_type || 'N/D'}
Data verifica: ${new Date().toLocaleString('it-IT')}

Accedi alla dashboard FixGo per verificare la qualità del profilo.

— FixGo
  `.trim();

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#10B981">Nuovo professionista verificato</h2>
  <table style="border-collapse:collapse;width:100%;margin:16px 0">
    <tr><td style="padding:8px 0;font-weight:bold;color:#64748B">Nome</td><td style="padding:8px 0">${pro.name || 'N/D'}</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold;color:#64748B">Servizio</td><td style="padding:8px 0">${pro.service_type || 'N/D'}</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold;color:#64748B">Verificato il</td><td style="padding:8px 0">${new Date().toLocaleString('it-IT')}</td></tr>
  </table>
  <p><a href="https://drift-7.polsia.app" style="color:#2563EB">Accedi alla dashboard FixGo</a></p>
</div>`;

  const res = await fetch(`${EMAIL_PROXY}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.POLSIA_API_KEY}`,
    },
    body: JSON.stringify({ to, subject, body, html }),
  });
  if (res.ok) {
    console.log('[notifications] Pro verified email sent to admin');
  } else {
    const err = await res.text();
    console.error('[notifications] Pro verified email failed:', err);
  }
}

// Expose for direct use in routes
module.exports = { sendBookingEmails, sendProVerifiedEmail, formatDate };