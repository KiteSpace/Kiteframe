import { Request, Response } from 'express';
import { sendEmail } from './emailService';

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

    if (!reportData.subject || !reportData.description) {
      return res.status(400).json({
        success: false,
        error: 'Subject and description are required',
      });
    }

    const reportType =
      reportData.type === 'bug' ? '🐛 Bug Report' :
      reportData.type === 'feature' ? '✨ Feature Request' :
      '⚡ Improvement Suggestion';

    let text = `${reportType} - ${reportData.subject}\n\n`;
    text += `${reportData.type === 'bug' ? 'PROBLEM DESCRIPTION' : 'REQUEST DESCRIPTION'}:\n${reportData.description}`;

    if (reportData.type === 'bug') {
      if (reportData.stepsToReproduce) text += `\n\nSTEPS TO REPRODUCE:\n${reportData.stepsToReproduce}`;
      if (reportData.expectedBehavior) text += `\n\nEXPECTED BEHAVIOR:\n${reportData.expectedBehavior}`;
      if (reportData.actualBehavior) text += `\n\nACTUAL BEHAVIOR:\n${reportData.actualBehavior}`;
    }

    text += `\n\nTECHNICAL INFORMATION:
- Timestamp: ${reportData.timestamp}
- User Agent: ${reportData.userAgent}
- URL: ${reportData.url}
- Contact Email: ${reportData.contactEmail || 'Not provided'}`;

    if (reportData.includeErrorLogs && reportData.errorLogs) {
      text += `\n\nERROR LOGS:\n${reportData.errorLogs}`;
    }

    const success = await sendEmail({
      to: 'info@kiteframe.space',
      subject: `[Kiteframe] ${reportType}: ${reportData.subject}`,
      text,
      html: text.replace(/\n/g, '<br>'),
      replyTo: reportData.contactEmail || undefined,
    });

    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to send report. Please try again later.' });
    }

    console.log(`📧 Report sent: ${reportData.type} - ${reportData.subject}`);
    res.json({ success: true, message: 'Report sent successfully' });

  } catch (error) {
    console.error('Error sending bug report:', error);
    res.status(500).json({ success: false, error: 'Failed to send bug report. Please try again later.' });
  }
}
