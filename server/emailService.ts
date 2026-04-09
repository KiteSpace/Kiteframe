import sgMail from '@sendgrid/mail';

const FROM_ADDRESS = process.env.SENDGRID_FROM || 'info@kiteframe.space';

function isConfigured(): boolean {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not configured, skipping email send');
    return false;
  }
  return true;
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string;
  replyTo?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!isConfigured()) return false;

  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

  try {
    await sgMail.send({
      to: options.to,
      from: FROM_ADDRESS,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text.replace(/\n/g, '<br>'),
      ...(options.cc ? { cc: options.cc } : {}),
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
    });
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

export async function sendBetaApprovalEmail(userEmail: string, firstName?: string | null): Promise<boolean> {
  const name = firstName || 'there';

  const subject = "You're in! Welcome to the Kiteframe";

  const text = `Hi ${name},

Great news! Your request to join the Kiteframe has been approved.

You can now access Kiteframe by signing in at:
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
    <p style="color: #666; font-size: 18px; margin-top: 0;">Welcome to Kiteframe</p>
  </div>
  
  <p>Hi ${name},</p>
  
  <p>Great news! Your request to join <strong>Kiteframe</strong> has been approved.</p>
  
  <p>You can now access Kiteframe!</p>
  
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
    You received this email because you requested access to Kiteframe.
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

export async function sendWaitlistConfirmationEmail(userEmail: string, firstName?: string | null): Promise<boolean> {
  const name = firstName || 'there';

  const subject = "You're on the Kiteframe waitlist";

  const text = `Hi ${name},

Thanks for your interest in Kiteframe! You're now on our waitlist.

We're currently in an early access launch and working through requests as fast as we can. We'll email you as soon as a spot opens up — usually within a few days.

In the meantime, feel free to check out our site at https://kiteframe.space to learn more about what we're building.

Talk soon,

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
    <h1 style="color: #2563eb; margin-bottom: 5px;">You're on the list</h1>
    <p style="color: #666; font-size: 18px; margin-top: 0;">Kiteframe Waitlist Confirmation</p>
  </div>
  
  <p>Hi ${name},</p>
  
  <p>Thanks for your interest in <strong>Kiteframe</strong>! You're now on our waitlist.</p>
  
  <p>We're currently in an early access launch and working through requests as fast as we can. We'll email you as soon as a spot opens up — usually within a few days.</p>
  
  <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #1e40af;">What is Kiteframe?</h3>
    <p style="margin-bottom: 0;">A visual workflow editor with AI-powered generation, PRD creation, and intelligent diagram analysis — built for teams that think in systems.</p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="https://kiteframe.space" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Learn More</a>
  </div>
  
  <p>Talk soon,</p>
  
  <p style="color: #666;">
    The Kiteframe Team<br>
    <a href="https://kiteframe.space" style="color: #2563eb;">kiteframe.space</a>
  </p>
  
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #94a3b8; text-align: center;">
    You received this email because you signed up for the Kiteframe waitlist.
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

export async function sendContactEmail(
  senderEmail: string,
  senderName: string,
  message: string
): Promise<boolean> {
  const subject = `[Kiteframe Contact] Message from ${senderName}`;

  const text = `New contact form submission from Kiteframe website:

From: ${senderName}
Email: ${senderEmail}

Message:
${message}

---
This message was sent via the contact form on kiteframe.space`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #2563eb; margin-bottom: 20px;">New Contact Form Submission</h2>
  
  <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <p style="margin: 0 0 10px 0;"><strong>From:</strong> ${senderName}</p>
    <p style="margin: 0;"><strong>Email:</strong> <a href="mailto:${senderEmail}">${senderEmail}</a></p>
  </div>
  
  <h3 style="color: #1e40af; margin-bottom: 10px;">Message:</h3>
  <div style="background-color: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
    <p style="margin: 0; white-space: pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
  </div>
  
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #94a3b8; text-align: center;">
    This message was sent via the contact form on kiteframe.space
  </p>
</body>
</html>`;

  return sendEmail({
    to: 'info@kiteframe.space',
    cc: 'adaly.design@gmail.com',
    replyTo: senderEmail,
    subject,
    text,
    html,
  });
}

export async function sendDocsAccessEmail(
  recipientEmail: string,
  loginLink: string
): Promise<boolean> {
  if (!isConfigured()) return false;

  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

  try {
    await sgMail.send({
      to: recipientEmail,
      from: FROM_ADDRESS,
      subject: 'Your Kiteframe Developer Documentation Access',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Developer Documentation Access</h2>
          <p>You've been granted access to Kiteframe's internal developer documentation.</p>
          <p>Click the link below to access the docs:</p>
          <p><a href="${loginLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Access Documentation</a></p>
          <p style="color: #666; font-size: 14px;">This link expires in 24 hours. After clicking, you'll stay logged in for 30 days.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error('Failed to send docs access email:', error);
    return false;
  }
}
