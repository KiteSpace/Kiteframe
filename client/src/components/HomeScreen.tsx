import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Sparkles, 
  Upload, 
  ArrowRight, 
  ArrowLeft,
  Clock, 
  MoreVertical,
  Workflow,
  Users,
  GitBranch,
  Zap,
  Settings,
  Database,
  Globe,
  Plus,
  FolderOpen,
  Share2,
  Download,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { useCreditsGate } from '@/hooks/useCreditsGate';
import { useSubscription } from '@/hooks/useSubscription';
import { FeatureUpsellDialog } from './FeatureUpsellDialog';

interface RecentProject {
  id: string;
  name: string;
  lastModified: Date;
  thumbnail?: string;
  status: 'published' | 'private' | 'draft';
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  thumbnail?: string;
  category: string;
  prompt: string;
}

interface HomeScreenProps {
  recentProjects: RecentProject[];
  onOpenProject: (projectId: string) => void;
  onGenerateWorkflow: (prompt: string) => void;
  onCreateBlankWorkflow: () => void;
  onUploadImage: () => void;
  onShareProject?: (projectId: string) => void;
  onDownloadProject?: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  isGenerating?: boolean;
}

const quickExamples = [
  { label: 'User Onboarding Flow', prompt: 'Create a user onboarding workflow that includes account creation, email verification, profile setup, and a welcome tutorial' },
  { label: 'API Request Handler', prompt: 'Design an API request handling workflow with authentication, rate limiting, request validation, processing, and response formatting' },
  { label: 'Decision Tree', prompt: 'Build a customer support decision tree workflow that routes inquiries to the right department based on issue type and priority' },
];

const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'template-1',
    name: 'User Authentication Flow',
    description: 'Complete auth workflow with login, signup, and password reset',
    author: 'Kiteframe',
    category: 'Authentication',
    prompt: 'Create a user authentication workflow with login form, credential validation, session creation, error handling for invalid credentials, and password reset flow'
  },
  {
    id: 'template-2',
    name: 'E-commerce Checkout',
    description: 'Shopping cart to order confirmation workflow',
    author: 'Kiteframe',
    category: 'E-commerce',
    prompt: 'Design an e-commerce checkout workflow starting from cart review, shipping address, payment processing, order confirmation, and email notification'
  },
  {
    id: 'template-3',
    name: 'Data Pipeline',
    description: 'ETL workflow for data processing',
    author: 'Kiteframe',
    category: 'Data',
    prompt: 'Create a data pipeline workflow with data extraction from multiple sources, transformation steps, validation, and loading into a database'
  },
  {
    id: 'template-4',
    name: 'CI/CD Pipeline',
    description: 'Continuous integration and deployment workflow',
    author: 'Kiteframe',
    category: 'DevOps',
    prompt: 'Build a CI/CD pipeline workflow with code commit, automated testing, code review, staging deployment, and production release with rollback capability'
  },
  {
    id: 'template-5',
    name: 'Customer Support Ticket',
    description: 'Ticket routing and resolution workflow',
    author: 'Kiteframe',
    category: 'Support',
    prompt: 'Design a customer support ticket workflow with ticket creation, priority assessment, agent assignment, resolution tracking, and customer feedback collection'
  },
  {
    id: 'template-6',
    name: 'Content Approval',
    description: 'Multi-stage content review workflow',
    author: 'Kiteframe',
    category: 'Content',
    prompt: 'Create a content approval workflow with draft submission, editorial review, stakeholder approval, revision requests, and final publication'
  },
];

const categoryIcons: Record<string, typeof Workflow> = {
  'Authentication': Users,
  'E-commerce': Globe,
  'Data': Database,
  'DevOps': GitBranch,
  'Support': Settings,
  'Content': Zap,
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export function HomeScreen({
  recentProjects,
  onOpenProject,
  onGenerateWorkflow,
  onCreateBlankWorkflow,
  onUploadImage,
  onShareProject,
  onDownloadProject,
  onDeleteProject,
  isGenerating = false
}: HomeScreenProps) {
  const [promptValue, setPromptValue] = useState('');
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [showFeatureUpsell, setShowFeatureUpsell] = useState(false);
  const [featureUpsellType, setFeatureUpsellType] = useState<'image' | 'wireframe'>('image');
  
  const { tier } = useSubscription();
  const projectToDelete = recentProjects.find(p => p.id === deleteProjectId);
  
  const { 
    credits, 
    isOutOfCredits, 
    isAuthenticated, 
    ctaMessage, 
    ctaAction, 
    ctaButtonText,
    openSignup,
    openPricing,
    openCreditsDialog
  } = useCreditsGate();
  
  const showZeroCreditsWarning = isOutOfCredits && !isAuthenticated;

  const handleExampleClick = useCallback((prompt: string) => {
    setPromptValue(prompt);
  }, []);

  const handleTemplateClick = useCallback((template: WorkflowTemplate) => {
    setPromptValue(template.prompt);
  }, []);

  const handleGenerate = useCallback(() => {
    // Defense in depth: check credits before generating
    if (isOutOfCredits) {
      if (ctaAction === 'signup') openSignup();
      else if (ctaAction === 'upgrade') openPricing();
      else openCreditsDialog();
      return;
    }
    if (promptValue.trim()) {
      onGenerateWorkflow(promptValue.trim());
    }
  }, [promptValue, onGenerateWorkflow, isOutOfCredits, ctaAction, openSignup, openPricing, openCreditsDialog]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Block keyboard shortcut when out of credits
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && promptValue.trim() && !isGenerating && !isOutOfCredits) {
      handleGenerate();
    }
  }, [promptValue, isGenerating, isOutOfCredits, handleGenerate]);

  const handleConfirmDelete = useCallback(() => {
    if (deleteProjectId && onDeleteProject) {
      onDeleteProject(deleteProjectId);
      setDeleteProjectId(null);
    }
  }, [deleteProjectId, onDeleteProject]);

  const renderProjectCard = (project: RecentProject, showMenu = true) => (
    <Card
      key={project.id}
      className="cursor-pointer hover:border-primary/50 transition-colors group"
      onClick={() => onOpenProject(project.id)}
      data-testid={`card-project-${project.id}`}
    >
      <div className="aspect-video bg-muted rounded-t-lg overflow-hidden relative">
        {project.thumbnail ? (
          <img 
            src={project.thumbnail} 
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Workflow size={32} className="text-muted-foreground/50" />
          </div>
        )}
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                onClick={(e) => e.stopPropagation()}
                data-testid={`button-project-menu-${project.id}`}
              >
                <MoreVertical size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenProject(project.id);
                }}
                data-testid={`menu-open-${project.id}`}
              >
                <FolderOpen size={14} className="mr-2" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onShareProject?.(project.id);
                }}
                data-testid={`menu-share-${project.id}`}
              >
                <Share2 size={14} className="mr-2" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadProject?.(project.id);
                }}
                data-testid={`menu-download-${project.id}`}
              >
                <Download size={14} className="mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteProjectId(project.id);
                }}
                className="text-destructive focus:text-destructive"
                data-testid={`menu-delete-${project.id}`}
              >
                <Trash2 size={14} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <CardContent className="p-3">
        <h3 className="font-medium truncate">{project.name}</h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground flex items-center">
            <Clock size={12} className="mr-1" />
            {formatTimeAgo(project.lastModified)}
          </span>
          <Badge 
            variant={project.status === 'published' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {project.status === 'published' ? 'Published' : project.status === 'private' ? 'Private' : 'Draft'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  // All Projects View
  if (showAllProjects) {
    return (
      <div className="flex-1 overflow-auto bg-background">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Header with back button */}
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllProjects(false)}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-back-home"
            >
              <ArrowLeft size={16} className="mr-1" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">All Projects</h1>
          </div>

          {/* Projects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* New Project Tile */}
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors group border-dashed"
              onClick={onCreateBlankWorkflow}
              data-testid="card-new-project"
            >
              <div className="aspect-video bg-muted/50 rounded-t-lg overflow-hidden flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Plus size={24} className="text-primary" />
                </div>
              </div>
              <CardContent className="p-3">
                <h3 className="font-medium text-center">New Project</h3>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Start from scratch
                </p>
              </CardContent>
            </Card>

            {/* Project Cards */}
            {recentProjects.map((project) => renderProjectCard(project))}
          </div>

          {recentProjects.length === 0 && (
            <div className="text-center py-12">
              <Workflow size={48} className="mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first workflow to get started
              </p>
              <Button onClick={onCreateBlankWorkflow} data-testid="button-create-first-project">
                <Plus size={16} className="mr-2" />
                Create Project
              </Button>
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteProjectId} onOpenChange={(open) => !open && setDeleteProjectId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{projectToDelete?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Main Home View
  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Zero Credits Warning Banner */}
        {showZeroCreditsWarning && (
          <div className="mb-6 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4 flex items-center gap-3" data-testid="banner-zero-credits">
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                You've run out of free trial credits
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                Create an account to get monthly credits and unlock the full power of KiteAI.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => window.dispatchEvent(new CustomEvent('openSignUp'))}
              data-testid="button-signup-banner"
            >
              Sign Up Free
            </Button>
          </div>
        )}

        {/* AI Prompt Section */}
        <div className="mb-10">
          <div className={`bg-card border border-border rounded-xl p-4 ${isOutOfCredits ? 'opacity-60' : ''}`}>
            <Textarea
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isOutOfCredits ? "AI generation disabled - out of credits" : "Describe the workflow you want to create, or upload an image"}
              className="min-h-[100px] resize-none border-0 p-0 focus-visible:ring-0 text-base bg-transparent"
              disabled={isOutOfCredits}
              data-testid="input-workflow-prompt"
            />
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Image upload is Pro tier only
                    if (tier !== 'pro') {
                      setFeatureUpsellType('image');
                      setShowFeatureUpsell(true);
                    } else {
                      onUploadImage();
                    }
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  disabled={isOutOfCredits}
                  data-testid="button-upload-image"
                >
                  <Upload size={16} className="mr-1" />
                  Upload Image
                </Button>
              </div>
              {isOutOfCredits ? (
                <Button
                  onClick={() => {
                    if (ctaAction === 'signup') openSignup();
                    else if (ctaAction === 'upgrade') openPricing();
                    else openCreditsDialog();
                  }}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  data-testid="button-get-credits"
                >
                  <Sparkles size={16} className="mr-2" />
                  {ctaButtonText}
                </Button>
              ) : (
                <Button
                  onClick={handleGenerate}
                  disabled={!promptValue.trim() || isGenerating}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="button-start-designing"
                >
                  {isGenerating ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} className="mr-2" />
                      Start designing
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {isOutOfCredits 
              ? ctaMessage 
              : "The fastest way to create visual workflows – ideal for designers and PMs. See results in ~30 seconds."
            }
          </p>

          {/* Quick Example Chips */}
          <div className="mt-4">
            <span className="text-sm text-muted-foreground mr-3">Start with an example</span>
            <div className="inline-flex flex-wrap gap-2 mt-2">
              {quickExamples.map((example) => (
                <button
                  key={example.label}
                  onClick={() => handleExampleClick(example.prompt)}
                  disabled={isOutOfCredits}
                  className={`inline-flex items-center px-3 py-1.5 rounded-full bg-muted text-sm text-foreground transition-colors ${isOutOfCredits ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/80'}`}
                  data-testid={`chip-example-${example.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Workflow size={14} className="mr-1.5 text-muted-foreground" />
                  {example.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Projects Section */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold mb-4">Recent Projects</h2>
          
          {!isAuthenticated ? (
            /* Promo Card for Non-Authenticated Users */
            <div 
              className="rounded-xl p-6"
              style={{
                background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)'
              }}
              data-testid="promo-signup-card"
            >
              <h3 className="text-base font-semibold text-foreground mb-2">
                Sign up for a Pro Account to save your projects
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                Want to save your projects so it's easy to pick back up where you left off? Create a Pro account to get access to cloud storage, increased tokens, and more!
              </p>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => window.dispatchEvent(new CustomEvent('openSignIn'))}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                  data-testid="button-signin-promo"
                >
                  Sign in
                </Button>
                <Button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('openSignUp'))}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid="button-signup-promo"
                >
                  Sign up
                </Button>
              </div>
            </div>
          ) : recentProjects.length > 0 ? (
            /* Authenticated User with Projects */
            <>
              <div className="flex items-center justify-between mb-4 -mt-4">
                <span></span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAllProjects(true)}
                  data-testid="button-view-all-projects"
                >
                  View All <ArrowRight size={14} className="ml-1" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentProjects.slice(0, 3).map((project) => renderProjectCard(project))}
              </div>
            </>
          ) : (
            /* Authenticated User with No Projects */
            <div className="text-center py-8 bg-muted/30 rounded-lg">
              <Workflow size={32} className="mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground text-sm">No projects yet. Create your first workflow above!</p>
            </div>
          )}
        </div>

        {/* Feature Upsell Dialog */}
        <FeatureUpsellDialog
          isOpen={showFeatureUpsell}
          onClose={() => setShowFeatureUpsell(false)}
          featureName={featureUpsellType === 'image' ? 'Image-to-Workflow Generator' : 'Wireframe Generator'}
          requiredTier={featureUpsellType === 'image' ? 'pro' : 'advanced'}
          description={featureUpsellType === 'image' 
            ? 'Convert your sketches and wireframes into interactive workflows using AI-powered image analysis!'
            : 'Generate wireframe layouts from text descriptions using AI!'}
        />

        {/* Delete Confirmation Dialog (for home view) */}
        <AlertDialog open={!!deleteProjectId} onOpenChange={(open) => !open && setDeleteProjectId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{projectToDelete?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Quick Start Templates Section */}
        <div className={isOutOfCredits ? 'opacity-60' : ''}>
          <h2 className="text-lg font-semibold mb-4">Quick Start Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflowTemplates.map((template) => {
              const IconComponent = categoryIcons[template.category] || Workflow;
              return (
                <Card
                  key={template.id}
                  className={`transition-colors group ${isOutOfCredits ? 'cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}`}
                  onClick={() => !isOutOfCredits && handleTemplateClick(template)}
                  data-testid={`card-template-${template.id}`}
                >
                  <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 rounded-t-lg overflow-hidden flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
                        <IconComponent size={24} className="text-primary" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{template.category}</span>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-medium">{template.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {template.description}
                    </p>
                    <div className="mt-2 pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        by {template.author}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
