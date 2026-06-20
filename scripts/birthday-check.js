const nodemailer = require('nodemailer');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const FROM_EMAIL = 'lisa@geriatricwellness.net';
const TO_EMAIL = 'skish.heartland@gmail.com';
const DAYS_AHEAD = 7;

async function main() {
  console.log(`Checking for birthdays in ${DAYS_AHEAD} days...`);

  // Fetch all active clients with a DOB
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=*&status=eq.active&dob=not.is.null`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  if (!resp.ok) {
    throw new Error(`Supabase error: ${resp.status} ${await resp.text()}`);
  }

  const clients = await resp.json();
  console.log(`Loaded ${clients.length} active clients with DOB.`);

  // Find clients whose birthday is exactly DAYS_AHEAD from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(today);
  target.setDate(target.getDate() + DAYS_AHEAD);

  const upcoming = clients.filter(c => {
    const [, m, d] = c.dob.split('-').map(Number);
    // Check this year and next year (handles year-end edge cases)
    const thisYear = new Date(target.getFullYear(), m - 1, d);
    const nextYear = new Date(target.getFullYear() + 1, m - 1, d);
    return thisYear.getTime() === target.getTime() || nextYear.getTime() === target.getTime();
  });

  if (!upcoming.length) {
    console.log('No birthdays in 7 days. No email sent.');
    return;
  }

  console.log(`Found ${upcoming.length} birthday(s): ${upcoming.map(c => c.full_name).join(', ')}`);

  // Set up Gmail transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: FROM_EMAIL,
      pass: GMAIL_APP_PASSWORD
    }
  });

  for (const c of upcoming) {
    const [y, m, d] = c.dob.split('-').map(Number);
    const birthdayDate = new Date(target.getFullYear(), m - 1, d);
    const age = target.getFullYear() - y;
    const bdayFormatted = birthdayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const displayName = c.preferred_name ? `${c.full_name} (${c.preferred_name})` : c.full_name;

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px;background:#f4f4f6;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1)">

    <div style="background:#1B2B4B;padding:20px 28px;border-bottom:3px solid #C9A84C">
      <div style="color:white;font-size:20px;font-weight:700">🎂 Birthday Card Reminder</div>
      <div style="color:#C9A84C;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin-top:4px">GWCC White Glove Client Services</div>
    </div>

    <div style="padding:28px">
      <p style="font-size:14px;color:#2C2C3E;margin:0 0 16px">Hi Susanne,</p>
      <p style="font-size:14px;color:#2C2C3E;margin:0 0 20px">
        A client birthday is coming up in <strong>7 days</strong>. Please prepare and mail the card today so it arrives on time.
      </p>

      <div style="background:#FAF8F4;border:1px solid #E8E8EC;border-radius:8px;padding:20px;margin-bottom:20px">
        <div style="font-size:20px;font-weight:700;color:#1B2B4B;font-family:Georgia,serif">${displayName}</div>
        <div style="margin-top:12px;display:grid;gap:8px">
          <div style="font-size:13px;color:#5A5A72">
            🎂 <strong>Birthday:</strong> ${bdayFormatted} — turning <strong>${age}</strong>
          </div>
          ${c.address ? `<div style="font-size:13px;color:#5A5A72">📍 <strong>Address:</strong> ${c.address}</div>` : ''}
          ${c.home_situation ? `<div style="font-size:13px;color:#5A5A72">🏠 <strong>Home:</strong> ${c.home_situation}</div>` : ''}
          ${c.primary_contact_name ? `<div style="font-size:13px;color:#5A5A72">👤 <strong>Contact:</strong> ${c.primary_contact_name}${c.primary_contact_relation ? ' (' + c.primary_contact_relation + ')' : ''}</div>` : ''}
        </div>
        ${c.client_code ? `<div style="margin-top:12px;font-size:10px;color:#9B9BAD;font-family:monospace">${c.client_code}</div>` : ''}
      </div>

      <div style="background:#E8F5EE;border-radius:6px;padding:12px 16px;margin-bottom:20px">
        <div style="font-size:13px;color:#2D7D4F;font-weight:600">✅ Action needed</div>
        <div style="font-size:13px;color:#2D7D4F;margin-top:4px">Mail the birthday card by today so it arrives by <strong>${bdayFormatted}</strong>.</div>
      </div>

      <p style="font-size:12px;color:#9B9BAD;margin:0;border-top:1px solid #E8E8EC;padding-top:16px">
        This is an automated reminder from the GWCC Client Management System.<br>
        Sent on behalf of Lisa Adamek · geriatricwellness.net
      </p>
    </div>

  </div>
</body>
</html>`;

    await transporter.sendMail({
      from: `"GWCC Client Services" <${FROM_EMAIL}>`,
      to: TO_EMAIL,
      subject: `🎂 Send birthday card — ${c.full_name} · ${bdayFormatted}`,
      html
    });

    console.log(`✓ Email sent to Susanne for ${c.full_name} (birthday ${bdayFormatted})`);
  }
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
