import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Bug, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface BugReportModalProps {
  onClose: () => void;
}

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
}

export function BugReportModal({ onClose }: BugReportModalProps) {
  const [formData, setFormData] = useState<{
    type: 'bug' | 'feature' | 'improvement';
    subject: string;
    description: string;
    stepsToReproduce: string;
    expectedBehavior: string;
    actualBehavior: string;
    includeErrorLogs: boolean;
    email: string;
  }>({
    type: 'bug',
    subject: '',
    description: '',
    stepsToReproduce: '',
    expectedBehavior: '',
    actualBehavior: '',
    includeErrorLogs: true,
    email: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  // Simple math CAPTCHA (since we can't use external services without integration)
  const [mathCaptcha] = useState(() => {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    return { a, b, answer: a + b, question: `${a} + ${b} = ?` };
  });
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const collectErrorLogs = () => {
    const logs: string[] = [];
    
    // Collect console logs (if available)
    if (formData.includeErrorLogs) {
      // Get recent console logs from browser if available
      const consoleEntries = (window as any).__kiteframe_console_logs__ || [];
      
      logs.push('=== Browser Console Logs (Recent) ===');
      if (consoleEntries.length > 0) {
        logs.push(...consoleEntries.slice(-50)); // Last 50 entries
      } else {
        logs.push('No console logs captured');
      }
      
      logs.push('\n=== Browser Information ===');
      logs.push(`User Agent: ${navigator.userAgent}`);
      logs.push(`URL: ${window.location.href}`);
      logs.push(`Timestamp: ${new Date().toISOString()}`);
      logs.push(`Screen: ${screen.width}x${screen.height}`);
      logs.push(`Viewport: ${window.innerWidth}x${window.innerHeight}`);
      logs.push(`Language: ${navigator.language}`);
      
      // Memory information if available
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        logs.push(`Memory Used: ${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`);
        logs.push(`Memory Total: ${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`);
        logs.push(`Memory Limit: ${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`);
      }
    }
    
    return logs.join('\n');
  };

  const validateForm = (): boolean => {
    if (!formData.subject.trim()) {
      toast({
        title: "Subject Required",
        description: "Please enter a subject for your report.",
        variant: "destructive"
      });
      return false;
    }

    if (!formData.description.trim()) {
      toast({
        title: "Description Required", 
        description: "Please describe the issue or feature request.",
        variant: "destructive"
      });
      return false;
    }

    if (parseInt(captchaAnswer) !== mathCaptcha.answer) {
      toast({
        title: "CAPTCHA Failed",
        description: "Please solve the math problem correctly.",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);

    try {
      const reportData: BugReportData = {
        type: formData.type,
        subject: formData.subject,
        description: formData.description,
        stepsToReproduce: formData.stepsToReproduce,
        expectedBehavior: formData.expectedBehavior,
        actualBehavior: formData.actualBehavior,
        includeErrorLogs: formData.includeErrorLogs,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      };

      const errorLogs = collectErrorLogs();

      // Use Formspree for simple form handling (no backend needed)
      const formDataToSend = new FormData();
      formDataToSend.append('type', reportData.type);
      formDataToSend.append('subject', reportData.subject);
      formDataToSend.append('description', reportData.description);
      formDataToSend.append('steps_to_reproduce', reportData.stepsToReproduce || '');
      formDataToSend.append('expected_behavior', reportData.expectedBehavior || '');
      formDataToSend.append('actual_behavior', reportData.actualBehavior || '');
      formDataToSend.append('contact_email', formData.email.trim());
      formDataToSend.append('user_agent', reportData.userAgent);
      formDataToSend.append('page_url', reportData.url);
      formDataToSend.append('timestamp', reportData.timestamp);
      
      if (formData.includeErrorLogs) {
        formDataToSend.append('error_logs', errorLogs);
      }
      
      const response = await fetch('https://formspree.io/f/xpwzwrej', {
        method: 'POST',
        body: formDataToSend,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setSubmitted(true);
        toast({
          title: "Report Sent Successfully!",
          description: "Thank you for your feedback. We'll review it soon.",
          variant: "default"
        });
      } else {
        throw new Error(result.error || 'Failed to send report');
      }
    } catch (error) {
      console.error('Bug report submission error:', error);
      toast({
        title: "Failed to Send Report",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-md" data-testid="modal-bug-report-success">
          <div className="text-center py-6">
            <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold mb-2">Report Sent Successfully!</h3>
            <p className="text-muted-foreground mb-4">
              Thank you for helping us improve Kiteframe. We'll review your feedback and get back to you if needed.
            </p>
            <Button onClick={onClose} className="w-full" data-testid="button-close-success">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-bug-report">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="text-primary" size={20} />
            Report Bug or Feature Request
          </DialogTitle>
        </DialogHeader>
        
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {/* Report Type */}
          <div className="space-y-2">
            <Label htmlFor="report-type">Report Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: 'bug' | 'feature' | 'improvement') => 
                setFormData(prev => ({ ...prev, type: value }))
              }
            >
              <SelectTrigger data-testid="select-report-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">🐛 Bug Report</SelectItem>
                <SelectItem value="feature">✨ Feature Request</SelectItem>
                <SelectItem value="improvement">⚡ Improvement Suggestion</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              placeholder={
                formData.type === 'bug' ? "Brief description of the bug" :
                formData.type === 'feature' ? "Feature you'd like to see" :
                "What could be improved"
              }
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              data-testid="input-subject"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              {formData.type === 'bug' ? 'Description *' : 'Details *'}
            </Label>
            <Textarea
              id="description"
              placeholder={
                formData.type === 'bug' ? "Describe what went wrong..." :
                formData.type === 'feature' ? "Describe the feature you'd like..." :
                "Describe your improvement suggestion..."
              }
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="min-h-[100px]"
              data-testid="textarea-description"
              required
            />
          </div>

          {/* Bug-specific fields */}
          {formData.type === 'bug' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="steps">Steps to Reproduce</Label>
                <Textarea
                  id="steps"
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
                  value={formData.stepsToReproduce}
                  onChange={(e) => setFormData(prev => ({ ...prev, stepsToReproduce: e.target.value }))}
                  className="min-h-[80px]"
                  data-testid="textarea-steps"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expected">Expected Behavior</Label>
                  <Textarea
                    id="expected"
                    placeholder="What should happen..."
                    value={formData.expectedBehavior}
                    onChange={(e) => setFormData(prev => ({ ...prev, expectedBehavior: e.target.value }))}
                    className="min-h-[60px]"
                    data-testid="textarea-expected"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="actual">Actual Behavior</Label>
                  <Textarea
                    id="actual"
                    placeholder="What actually happened..."
                    value={formData.actualBehavior}
                    onChange={(e) => setFormData(prev => ({ ...prev, actualBehavior: e.target.value }))}
                    className="min-h-[60px]"
                    data-testid="textarea-actual"
                  />
                </div>
              </div>
            </>
          )}

          {/* Optional contact email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com (if you'd like us to follow up)"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              data-testid="input-email"
            />
          </div>

          {/* Include Error Logs Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-logs"
              checked={formData.includeErrorLogs}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, includeErrorLogs: !!checked }))
              }
              data-testid="checkbox-include-logs"
            />
            <Label htmlFor="include-logs" className="text-sm">
              Include error logs and technical details (recommended)
            </Label>
          </div>

          {/* CAPTCHA */}
          <div className="space-y-2">
            <Label htmlFor="captcha">Security Check *</Label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-mono bg-muted px-3 py-2 rounded">
                {mathCaptcha.question}
              </span>
              <Input
                id="captcha"
                type="number"
                placeholder="Answer"
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                className="w-20"
                data-testid="input-captcha"
                required
              />
            </div>
          </div>

          {/* Privacy Notice */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              This report will be sent securely to our development team. We respect your privacy and will only use this information to improve Kiteframe.
            </AlertDescription>
          </Alert>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              data-testid="button-cancel-bug-report"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
              data-testid="button-submit-bug-report"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Sending...
                </>
              ) : (
                'Send Report'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}