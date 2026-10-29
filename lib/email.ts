import { Resend } from 'resend';
import twilio from 'twilio';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] ?? character);
}

export function renderEmailOtpHtml(code: string): string {
  const safeCode = escapeHtml(code);
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Your Hidden Gem verification code</title></head>
<body style="margin:0;padding:0;background-color:#f5f4ed;color:#20332b;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Your Hidden Gem verification code is ${safeCode}. It expires in 5 minutes.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f4ed">
    <tr><td align="center" style="padding:36px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background-color:#fffefa;border:1px solid #e6e5db;border-radius:20px">
        <tr><td style="padding:32px 32px 12px">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td align="center" width="42" height="42" style="width:42px;height:42px;border-radius:14px;background-color:#176e50;color:#ffffff;font-size:21px;font-weight:bold">✦</td>
            <td style="padding-left:11px;color:#20332b;font-size:18px;font-weight:bold;letter-spacing:-.5px">hidden gem</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:20px 32px 32px">
          <p style="margin:0 0 10px;color:#176e50;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Your people, a little closer</p>
          <h1 style="margin:0 0 14px;color:#20332b;font-size:28px;line-height:1.2;letter-spacing:-1px">Your verification code</h1>
          <p style="margin:0 0 24px;color:#65736a;font-size:15px;line-height:1.6">Enter this code in Hidden Gem to verify your email address and continue.</p>
          <div style="padding:19px 12px;border:1px solid #e6e5db;border-radius:14px;background-color:#f7f8f2;text-align:center;color:#176e50;font-size:34px;font-weight:bold;letter-spacing:9px">${safeCode}</div>
          <p style="margin:18px 0 0;color:#65736a;font-size:13px;line-height:1.6">This code expires in <strong style="color:#20332b">5 minutes</strong>. If you didn’t request it, you can safely ignore this email.</p>
        </td></tr>
        <tr><td style="padding:18px 32px;border-top:1px solid #e6e5db;color:#78847c;font-size:11px;line-height:1.5">Hidden Gem · Share meaningful places with your people</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function normalizePhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return value.trim();
}

export async function sendEmailOtp(email: string, code: string): Promise<void> {
  const provider = (process.env.OTP_DELIVERY_PROVIDER ?? 'resend').toLowerCase();

  if (provider === 'twilio') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    const recipient = process.env.TWILIO_TO_NUMBER ?? normalizePhoneNumber(email);

    if (!accountSid || !authToken || !fromNumber || !recipient) {
      throw new Error('TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and TWILIO_TO_NUMBER must be configured to send SMS OTPs');
    }

    const client = twilio(accountSid, authToken);
    await client.messages.create({
      from: fromNumber,
      to: recipient,
      body: `Your Hidden Gem verification code is ${code}. It expires in 5 minutes.`
    });
    return;
  }

  if (provider !== 'resend') {
    throw new Error(`Unsupported OTP_DELIVERY_PROVIDER: ${provider}`);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error('RESEND_API_KEY and EMAIL_FROM must be configured to send email OTPs');
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: 'Your Hidden Gem verification code',
    text: `Your Hidden Gem verification code is ${code}. It expires in 5 minutes.`,
    html: renderEmailOtpHtml(code)
  });

  if (error) throw new Error(`Resend could not send the verification email: ${error.message}`);
}
