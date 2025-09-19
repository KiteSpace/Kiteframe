import { Request, Response } from 'express';

interface BugReportData {
  type: 'bug' | 'feature' | 'improvement';
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
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: 'info@kiteframe.space',
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