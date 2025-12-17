import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.privateemail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP credentials not configured, skipping email send');
    return false;
  }

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'info@kiteframe.space',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text.replace(/\n/g, '<br>'),
    });
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

export async function sendBetaApprovalEmail(userEmail: string, firstName?: string | null): Promise<boolean> {
  const name = firstName || 'there';
  
  const subject = "You're in! Welcome to the Kiteframe Beta";
  
  const text = `Hi ${name},

Great news! Your request to join the Kiteframe beta has been approved.

You can now access the full workflow editor and all beta features. Simply sign in at:
https://kiteframe.space

What you can do now:
- Create and manage visual workflows
- Use AI-powered workflow generation
- Generate PRDs from your workflow designs
- Collaborate with your team

We'd love to hear your feedback as you explore the platform. Feel free to use the feedback button in the app or reply to this email.

Welcome aboard!

The Kiteframe Team
https://kiteframe.space`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #2563eb; margin-bottom: 5px;">🎉 You're In!</h1>
    <p style="color: #666; font-size: 18px; margin-top: 0;">Welcome to the Kiteframe Beta</p>
  </div>
  
  <p>Hi ${name},</p>
  
  <p>Great news! Your request to join the <strong>Kiteframe beta</strong> has been approved.</p>
  
  <p>You can now access the full workflow editor and all beta features:</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="https://kiteframe.space" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Sign In to Kiteframe</a>
  </div>
  
  <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #1e40af;">What you can do now:</h3>
    <ul style="margin-bottom: 0; padding-left: 20px;">
      <li>Create and manage visual workflows</li>
      <li>Use AI-powered workflow generation</li>
      <li>Generate PRDs from your workflow designs</li>
      <li>Collaborate with your team</li>
    </ul>
  </div>
  
  <p>We'd love to hear your feedback as you explore the platform. Feel free to use the feedback button in the app or reply to this email.</p>
  
  <p>Welcome aboard!</p>
  
  <p style="color: #666;">
    The Kiteframe Team<br>
    <a href="https://kiteframe.space" style="color: #2563eb;">kiteframe.space</a>
  </p>
  
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #94a3b8; text-align: center;">
    You received this email because you requested access to the Kiteframe beta.
  </p>
</body>
</html>`;

  return sendEmail({
    to: userEmail,
    subject,
    text,
    html,
  });
}
