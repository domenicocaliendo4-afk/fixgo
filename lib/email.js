/**
 * Email sending via SendGrid Web API.
 * Owns: HTTP call to SendGrid, send helpers.
 * Does NOT own: API key management, email templates.
 * Uses native fetch — no npm dependency required.
 */

const SENDGRID_BASE = 'https://api.sendgrid.com/v3';
const SERVICE_LABELS = {
  carwash: 'Car Wash a domicilio',
  idraulica: 'Idraulica',
  elettricista: 'Elettricista',
  pulizie: 'Pulizie domestiche',
  altro: 'Altro / Non so ancora',
};

/**
 * Send a lead notification email via SendGrid API.
 * @param {string} name  — lead's name
 * @param {string} email — lead's email
 * @param {string} service — service of interest
 */
async function sendLeadNotification(name, email, service) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const toAddress = process.env.COMPANY_EMAIL || 'drift@polsia.app';
  const fromAddress = process.env.EMAIL_FROM || 'noreply@fixgo.app';
  const serviceLabel = SERVICE_LABELS[service] || service;
  const subject = `Nuovo lead FixGo: ${name} — ${serviceLabel}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563EB; border-bottom: 2px solid #2563EB; padding-bottom: 8px;">
        Nuovo lead dalla landing page FixGo
      </h2>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 0; font-weight: bold; width: 120px; color: #64748B;">Nome:</td>
          <td style="padding: 8px 0;">${name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #64748B;">Email:</td>
          <td style="padding: 8px 0;"><a href="mailto:${email}">${email}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #64748B;">Servizio:</td>
          <td style="padding: 8px 0;">${serviceLabel}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #64748B;">Data:</td>
          <td style="padding: 8px 0;">${new Date().toLocaleString('it-IT')}</td>
        </tr>
      </table>
      <a href="https://drift-7.polsia.app" style="display: inline-block; background: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">
        Vai alla dashboard FixGo →
      </a>
    </div>
  `;

  // No SendGrid key — log and continue (lead is already in DB)
  if (!apiKey) {
    console.log('[email] No SENDGRID_API_KEY set — lead notification logged instead:');
    console.log(`  name=${name}, email=${email}, service=${serviceLabel}`);
    return;
  }

  try {
    const res = await fetch(`${SENDGRID_BASE}/mail/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toAddress }], subject }],
        from: { email: fromAddress },
        content: [{ type: 'text/html', value: htmlBody }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[email] SendGrid error ${res.status}:`, text);
      return;
    }

    console.log('[email] Lead notification sent for:', email);
  } catch (err) {
    // Non-fatal — leads are already saved to DB
    console.error('[email] Failed to send lead notification:', err.message);
  }
}

module.exports = { sendLeadNotification };