// ============================================================
// worker/src/services/email.js — MailChannels (free in Workers)
// Replaces: nodemailer
// ============================================================

export const sendEmail = async (env, { to, toName, subject, html }) => {
  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: {
        email: env.SENDER_EMAIL || 'noreply@redwanmobile.com',
        name:  env.APP_NAME    || 'Redwan Mobile Shop',
      },
      to:      [{ email: to, name: toName || to }],
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('MailChannels error:', text);
    throw new Error('Failed to send email');
  }
};

// ── Welcome email ─────────────────────────────────────────────
export const sendWelcomeEmail = (env, email, name) =>
  sendEmail(env, {
    to: email, toName: name,
    subject: `Welcome to Redwan Mobile Shop, ${name}! 🎉`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#6C63FF">Welcome, ${name}!</h2>
        <p>Your account has been created successfully. Start exploring our latest smartphones.</p>
        <a href="${env.FRONTEND_URL || 'https://redwanmobile.com'}"
           style="background:#6C63FF;color:white;padding:12px 24px;border-radius:6px;text-decoration:none">
           Shop Now
        </a>
        <p style="color:#666;margin-top:24px">Redwan Mobile Shop — Bangladesh's #1 Mobile Store</p>
      </div>
    `,
  });

// ── Order confirmation email ──────────────────────────────────
export const sendOrderConfirmationEmail = (env, email, order) =>
  sendEmail(env, {
    to: email,
    subject: `Order Confirmed — ${order.order_number} 📦`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#6C63FF">Order Confirmed!</h2>
        <p>Your order <strong>${order.order_number}</strong> has been placed successfully.</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Total</strong></td>
              <td style="padding:8px;border-bottom:1px solid #eee">৳${order.total_amount}</td></tr>
          <tr><td style="padding:8px"><strong>Payment</strong></td>
              <td style="padding:8px">${order.payment_method?.toUpperCase()}</td></tr>
        </table>
        <p>We'll notify you when your order ships. Thank you for shopping with us!</p>
      </div>
    `,
  });
