import { Request, Response } from 'express';
import nodemailer from 'nodemailer';

interface BugReportData {
  type: 'bug' | 'feature' | 'improvement';
  department?: 'technical' | 'general' | 'sales';
  subject: string;
  description: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  includeErrorLogs: boolean;
  userAgent: string;
  url: string;
  timestamp: string;
  errorLogs?: string;
  contactEmail?: string;
}

export async function handleBugReport(req: Request, res: Response) {
  try {
    const reportData: BugReportData = req.body;
    
    // Validate required fields
    if (!reportData.subject || !reportData.description) {
      return res.status(400).json({
        success: false,
        error: 'Subject and description are required'
      });
    }

    // Build email content
    const reportType = reportData.type === 'bug' ? '🐛 Bug Report' :
                      reportData.type === 'feature' ? '✨ Feature Request' :
                      '⚡ Improvement Suggestion';
    
    let emailContent = `
${reportType} - ${reportData.subject}

${reportData.type === 'bug' ? 'PROBLEM DESCRIPTION:' : 'REQUEST DESCRIPTION:'}
${reportData.description}
`;

    if (reportData.type === 'bug') {
      if (reportData.stepsToReproduce) {
        emailContent += `\n\nSTEPS TO REPRODUCE:\n${reportData.stepsToReproduce}`;
      }
      
      if (reportData.expectedBehavior) {
        emailContent += `\n\nEXPECTED BEHAVIOR:\n${reportData.expectedBehavior}`;
      }
      
      if (reportData.actualBehavior) {
        emailContent += `\n\nACTUAL BEHAVIOR:\n${reportData.actualBehavior}`;
      }
    }

    emailContent += `

TECHNICAL INFORMATION:
- Timestamp: ${reportData.timestamp}
- User Agent: ${reportData.userAgent}
- URL: ${reportData.url}
- Contact Email: ${reportData.contactEmail || 'Not provided'}
`;

    if (reportData.includeErrorLogs && reportData.errorLogs) {
      emailContent += `\n\nERROR LOGS:\n${reportData.errorLogs}`;
    }

    // Use Nodemailer with SMTP for business email
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // false for STARTTLS (port 587)
      requireTLS: true, // require TLS for security
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        ciphers: 'SSLv3'
      }
    });

    // Secure email routing - addresses are only stored on server
    const getRecipientEmail = (department?: string) => {
      const emailMapping = {
        'technical': process.env.BUSINESS_EMAIL_TECH || process.env.BUSINESS_EMAIL,
        'general': process.env.BUSINESS_EMAIL_GENERAL || process.env.BUSINESS_EMAIL,
        'sales': process.env.BUSINESS_EMAIL_SALES || process.env.BUSINESS_EMAIL
      };
      
      return emailMapping[department as keyof typeof emailMapping] || process.env.BUSINESS_EMAIL || 'info@kiteframe.space';
    };

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: getRecipientEmail(reportData.department),
      subject: `[Kiteframe] ${reportType}: ${reportData.subject}`,
      text: emailContent,
      html: emailContent.replace(/\n/g, '<br>'),
      replyTo: reportData.contactEmail || undefined,
    };

    await transporter.sendMail(mailOptions);
    
    console.log(`📧 Bug report sent successfully: ${reportData.type} - ${reportData.subject}`);
    
    res.json({
      success: true,
      message: 'Bug report sent successfully'
    });

  } catch (error) {
    console.error('Error sending bug report:', error);
    
    // Don't expose internal errors to client
    res.status(500).json({
      success: false,
      error: 'Failed to send bug report. Please try again later.'
    });
  }
}