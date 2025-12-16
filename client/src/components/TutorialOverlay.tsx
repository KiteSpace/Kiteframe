import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  X, 
  ArrowRight, 
  ArrowLeft,
  Sparkles,
  MousePointer,
  Plus,
  Move,
  Layers,
  Workflow,
  Settings,
  CheckCircle2,
  PlayCircle,
} from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  highlightPadding?: number;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Kiteframe!',
    description: 'Let\'s take a quick tour of the key features. This will only take about a minute.',
    icon: <Sparkles className="h-6 w-6 text-violet-500" />,
    position: 'center',
  },
  {
    id: 'canvas',
    title: 'Your Workflow Canvas',
    description: 'This is your canvas where you\'ll build workflows. You can pan around by clicking and dragging on empty space, and zoom using your scroll wheel or trackpad.',
    icon: <Move className="h-6 w-6 text-blue-500" />,
    position: 'center',
  },
  {
    id: 'sidebar',
    title: 'Add Nodes from the Sidebar',
    description: 'Click the node icons on the left to add different types of nodes: inputs, processes, conditions, outputs, and AI tasks. Just click and drag onto the canvas!',
    icon: <Plus className="h-6 w-6 text-green-500" />,
    targetSelector: '[data-testid="sidebar"], [data-testid="collapsed-sidebar"]',
    position: 'right',
    highlightPadding: 8,
  },
  {
    id: 'connections',
    title: 'Connect Your Nodes',
    description: 'Click and drag from the small circles (connection ports) on the edges of nodes to create connections. This defines how your workflow flows.',
    icon: <Workflow className="h-6 w-6 text-cyan-500" />,
    position: 'center',
  },
  {
    id: 'properties',
    title: 'Edit Node Properties',
    description: 'Click on any node to select it. A properties panel will appear where you can customize the node\'s label, description, colors, and more.',
    icon: <MousePointer className="h-6 w-6 text-amber-500" />,
    position: 'center',
  },
  {
    id: 'project-panel',
    title: 'Project Panel & KiteAI',
    description: 'Use the panel on the right for project notes, workflow management, and KiteAI - your AI assistant that can generate workflows from text descriptions!',
    icon: <Layers className="h-6 w-6 text-purple-500" />,
    targetSelector: '[data-testid="project-panel"]',
    position: 'left',
    highlightPadding: 8,
  },
  {
    id: 'toolbar',
    title: 'Settings & Account',
    description: 'Access your settings, AI configuration, and account from the top toolbar. You can also toggle between light and dark themes here.',
    icon: <Settings className="h-6 w-6 text-slate-500" />,
    targetSelector: '[data-testid="toolbar"]',
    position: 'bottom',
    highlightPadding: 4,
  },
  {
    id: 'complete',
    title: 'You\'re Ready!',
    description: 'That\'s all you need to get started. Try adding some nodes and connecting them to create your first workflow. Have fun building!',
    icon: <CheckCircle2 className="h-6 w-6 text-green-500" />,
    position: 'center',
  },
];

const TUTORIAL_STORAGE_KEY = 'kiteframe-tutorial-completed';

interface TutorialOverlayProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export function TutorialOverlay({ onComplete, forceShow = false }: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const prevForceShowRef = useRef(forceShow);

  const step = TUTORIAL_STEPS[currentStep];
  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

  useEffect(() => {
    if (forceShow && !prevForceShowRef.current) {
      setCurrentStep(0);
      setIsVisible(true);
    }
    prevForceShowRef.current = forceShow;
  }, [forceShow]);

  useEffect(() => {
    if (forceShow) {
      return;
    }

    const hasCompleted = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!hasCompleted) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  useEffect(() => {
    if (!isVisible || !step.targetSelector) {
      setHighlightRect(null);
      return;
    }

    const updateHighlight = () => {
      const selectors = step.targetSelector!.split(',').map(s => s.trim());
      let element: Element | null = null;
      
      for (const selector of selectors) {
        element = document.querySelector(selector);
        if (element) break;
      }
      
      if (element) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setHighlightRect(rect);
        } else {
          setHighlightRect(null);
        }
      } else {
        setHighlightRect(null);
      }
    };

    updateHighlight();
    const interval = setInterval(updateHighlight, 500);
    window.addEventListener('resize', updateHighlight);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updateHighlight);
    };
  }, [isVisible, step.targetSelector, currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleComplete = useCallback(() => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    setIsVisible(false);
    onComplete?.();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    setIsVisible(false);
    onComplete?.();
  }, [onComplete]);

  const cardPosition = useMemo(() => {
    if (!highlightRect || step.position === 'center') {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = step.highlightPadding || 0;
    const cardWidth = 400;
    const cardHeight = 280;
    const gap = 16;

    switch (step.position) {
      case 'right':
        return {
          position: 'fixed' as const,
          top: Math.max(16, Math.min(highlightRect.top + highlightRect.height / 2 - cardHeight / 2, window.innerHeight - cardHeight - 16)),
          left: Math.min(highlightRect.right + padding + gap, window.innerWidth - cardWidth - 16),
        };
      case 'left':
        return {
          position: 'fixed' as const,
          top: Math.max(16, Math.min(highlightRect.top + highlightRect.height / 2 - cardHeight / 2, window.innerHeight - cardHeight - 16)),
          left: Math.max(16, highlightRect.left - padding - gap - cardWidth),
        };
      case 'bottom':
        return {
          position: 'fixed' as const,
          top: Math.min(highlightRect.bottom + padding + gap, window.innerHeight - cardHeight - 16),
          left: Math.max(16, Math.min(highlightRect.left + highlightRect.width / 2 - cardWidth / 2, window.innerWidth - cardWidth - 16)),
        };
      case 'top':
        return {
          position: 'fixed' as const,
          top: Math.max(16, highlightRect.top - padding - gap - cardHeight),
          left: Math.max(16, Math.min(highlightRect.left + highlightRect.width / 2 - cardWidth / 2, window.innerWidth - cardWidth - 16)),
        };
      default:
        return {
          position: 'fixed' as const,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  }, [highlightRect, step.position, step.highlightPadding]);

  const maskStyle = useMemo(() => {
    if (!highlightRect) {
      return undefined;
    }

    const padding = step.highlightPadding || 0;
    const x = highlightRect.left - padding;
    const y = highlightRect.top - padding;
    const w = highlightRect.width + padding * 2;
    const h = highlightRect.height + padding * 2;
    const r = 8;

    return {
      maskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Cdefs%3E%3Cmask id='hole'%3E%3Crect width='100%25' height='100%25' fill='white'/%3E%3Crect x='${x}' y='${y}' width='${w}' height='${h}' rx='${r}' fill='black'/%3E%3C/mask%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='white' mask='url(%23hole)'/%3E%3C/svg%3E")`,
      WebkitMaskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Cdefs%3E%3Cmask id='hole'%3E%3Crect width='100%25' height='100%25' fill='white'/%3E%3Crect x='${x}' y='${y}' width='${w}' height='${h}' rx='${r}' fill='black'/%3E%3C/mask%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='white' mask='url(%23hole)'/%3E%3C/svg%3E")`,
    };
  }, [highlightRect, step.highlightPadding]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999]" data-testid="tutorial-overlay">
      <div 
        className="absolute inset-0 bg-black/60 transition-opacity duration-300"
        style={maskStyle}
      />

      {highlightRect && (
        <div
          className="absolute border-2 border-violet-400 rounded-lg pointer-events-none"
          style={{
            top: highlightRect.top - (step.highlightPadding || 0),
            left: highlightRect.left - (step.highlightPadding || 0),
            width: highlightRect.width + (step.highlightPadding || 0) * 2,
            height: highlightRect.height + (step.highlightPadding || 0) * 2,
            boxShadow: '0 0 0 4px rgba(139, 92, 246, 0.3), 0 0 20px rgba(139, 92, 246, 0.4)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      )}

      <Card 
        className="w-[400px] shadow-2xl border-violet-200 dark:border-violet-800"
        style={cardPosition}
        data-testid="tutorial-card"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-violet-100 dark:bg-violet-900/50">
                {step.icon}
              </div>
              <div>
                <CardTitle className="text-lg">{step.title}</CardTitle>
                <CardDescription className="text-xs mt-1">
                  Step {currentStep + 1} of {TUTORIAL_STEPS.length}
                </CardDescription>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 -mt-1 -mr-2"
              onClick={handleSkip}
              data-testid="button-tutorial-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.description}
          </p>
          <Progress value={progress} className="mt-4 h-1" />
        </CardContent>
        <CardFooter className="flex justify-between pt-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            data-testid="button-tutorial-skip"
          >
            Skip Tour
          </Button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                data-testid="button-tutorial-previous"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              className="bg-violet-600 hover:bg-violet-700"
              data-testid="button-tutorial-next"
            >
              {currentStep < TUTORIAL_STEPS.length - 1 ? (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-1" />
                  Start Building
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export function useTutorial() {
  const [showTutorial, setShowTutorial] = useState(false);

  const startTutorial = useCallback(() => {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    setShowTutorial(true);
  }, []);

  const hasCompletedTutorial = useCallback(() => {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true';
  }, []);

  return {
    showTutorial,
    setShowTutorial,
    startTutorial,
    hasCompletedTutorial,
  };
}

export function resetTutorial() {
  localStorage.removeItem(TUTORIAL_STORAGE_KEY);
}
