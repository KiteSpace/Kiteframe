import { useState, useCallback, lazy, Suspense } from "react";
import { SiteFooter } from "./SiteFooter";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FloatingShapes = lazy(() => import("@/components/landing/FloatingShapes"));
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
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
  Plus,
  FolderOpen,
  Share2,
  Download,
  Trash2,
  AlertCircle,
  Copy,
  ChevronUp,
  Link,
} from "lucide-react";
import { useCreditsGate } from "@/hooks/useCreditsGate";
import { useSubscription } from "@/hooks/useSubscription";
import { HomeHero } from "./HomeHero";

interface RecentProject {
  id: string;
  name: string;
  lastModified: Date;
  thumbnail?: string;
  status: "published" | "private" | "draft";
  isLocal?: boolean;
  shareUuid?: string;
  isShareEnabled?: boolean;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  thumbnail?: string;
  category: string;
  templateType: string;
}

interface HomeScreenProps {
  recentProjects: RecentProject[];
  onOpenProject: (projectId: string) => void;
  onGenerateWorkflow: (prompt: string, generatePRD?: boolean) => void;
  onCreateBlankWorkflow: () => void;
  onLoadTemplate: (templateType: string) => void;
  onUploadImage: () => void;
  onImportFigma?: () => void;
  onShareProject?: (projectId: string, onCopied: () => void) => void;
  onRevokeProjectShare?: (projectId: string) => void;
  onDownloadProject?: (projectId: string) => void;
  onDuplicateProject?: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  isGenerating?: boolean;
  hasCloudAccess?: boolean;
}

const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "template-1",
    name: "User Journey Map",
    description: "Visualize customer touchpoints and experiences",
    author: "Kiteframe",
    category: "UX Design",
    templateType: "user-journey",
  },
  {
    id: "template-2",
    name: "Mind Map",
    description: "Brainstorm and organize ideas visually",
    author: "Kiteframe",
    category: "Planning",
    templateType: "mindmap",
  },
  {
    id: "template-3",
    name: "System Architecture",
    description: "Technical architecture diagram with components",
    author: "Kiteframe",
    category: "DevOps",
    templateType: "system-architecture",
  },
  {
    id: "template-4",
    name: "Swim Lanes",
    description: "Process flow with role-based lanes",
    author: "Kiteframe",
    category: "Process",
    templateType: "swim-lanes",
  },
  {
    id: "template-5",
    name: "User Account Creation",
    description: "Complete user registration workflow",
    author: "Kiteframe",
    category: "Authentication",
    templateType: "user-account-creation",
  },
  {
    id: "template-6",
    name: "I/O Logic Flow",
    description: "Input/output processing with decision logic",
    author: "Kiteframe",
    category: "Data",
    templateType: "io-logic",
  },
];

const categoryIcons: Record<string, typeof Workflow> = {
  "UX Design": Users,
  Planning: Zap,
  DevOps: GitBranch,
  Process: Settings,
  Authentication: Users,
  Data: Database,
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
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
  onLoadTemplate,
  onUploadImage,
  onImportFigma,
  onShareProject,
  onRevokeProjectShare,
  onDownloadProject,
  onDuplicateProject,
  onDeleteProject,
  isGenerating = false,
  hasCloudAccess = false,
}: HomeScreenProps) {
  const [, navigate] = useLocation();
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [copiedTooltip, setCopiedTooltip] = useState<{ projectId: string; x: number; y: number } | null>(null);

  const projectToDelete = recentProjects.find((p) => p.id === deleteProjectId);

  const {
    credits,
    isOutOfCredits,
    isAuthenticated,
    isServerAuthenticated,
    ctaMessage,
    ctaAction,
    ctaButtonText,
    openSignup,
    openCreditsDialog,
  } = useCreditsGate();

  const { isAdvanced, isAdmin } = useSubscription();
  const canUploadImage = isAdvanced || isAdmin;

  // User is considered authenticated if either Firebase or server session auth is present
  const isUserAuthenticated =
    isAuthenticated || isServerAuthenticated || hasCloudAccess;

  const showZeroCreditsWarning = isOutOfCredits && !isUserAuthenticated;

  const handleTemplateClick = useCallback(
    (template: WorkflowTemplate) => {
      onLoadTemplate(template.templateType);
    },
    [onLoadTemplate],
  );

  const handleStartDesigning = useCallback(
    (prompt: string) => {
      if (isOutOfCredits) {
        if (ctaAction === "signup") openSignup();
        else openCreditsDialog();
        return;
      }

      // Navigate to full-screen chat using SPA navigation - NO project creation here
      // Project is only created when user clicks "Create Workflow" in the chat
      // SPA navigation preserves PromptContextStore state for attachments
      const encodedPrompt = encodeURIComponent(prompt);
      navigate(`/app/chat?prompt=${encodedPrompt}`);
    },
    [
      isOutOfCredits,
      ctaAction,
      openSignup,
      openCreditsDialog,
      navigate,
    ],
  );

  const handleUploadImageWithGate = useCallback(
    (_files: FileList): boolean => {
      if (!canUploadImage) {
        window.dispatchEvent(new CustomEvent('showFeatureUpsell', { detail: { type: 'image-to-workflow' } }));
        return false;
      }
      return true;
    },
    [canUploadImage],
  );

  const handleImportFigmaWithGate = useCallback((): boolean => {
    return true;
  }, []);

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
            <DropdownMenuContent align="end" className="w-44">
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
                  const x = e.clientX;
                  const y = e.clientY;
                  onShareProject?.(project.id, () => {
                    setCopiedTooltip({ projectId: project.id, x, y });
                    setTimeout(() => setCopiedTooltip(null), 1800);
                  });
                }}
                data-testid={`menu-share-${project.id}`}
              >
                {project.isShareEnabled ? (
                  <>
                    <Link size={14} className="mr-2" />
                    Copy link
                  </>
                ) : (
                  <>
                    <Share2 size={14} className="mr-2" />
                    Share
                  </>
                )}
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
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateProject?.(project.id);
                }}
                data-testid={`menu-duplicate-${project.id}`}
              >
                <Copy size={14} className="mr-2" />
                Duplicate Project
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
          {project.isShareEnabled ? (
            <Badge
              variant="secondary"
              className="text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onRevokeProjectShare?.(project.id);
              }}
              title="Click to stop sharing"
              data-testid={`badge-shared-${project.id}`}
            >
              Shared
              <ChevronUp size={10} />
            </Badge>
          ) : (
            <Badge
              variant={project.status === "published" ? "default" : "secondary"}
              className="text-xs"
            >
              {project.status === "published"
                ? "Published"
                : project.status === "private"
                  ? "Private"
                  : "Draft"}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const CursorTooltip = copiedTooltip ? (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ left: copiedTooltip.x + 12, top: copiedTooltip.y - 20 }}
      data-testid="link-copied-tooltip"
    >
      <div className="bg-black/85 text-white text-xs font-medium px-2.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
        <Link size={10} />
        Link copied
      </div>
    </div>
  ) : null;

  // All Projects View
  if (showAllProjects) {
    return (
      <>
      {CursorTooltip}
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
              <Workflow
                size={48}
                className="mx-auto text-muted-foreground/50 mb-4"
              />
              <h3 className="text-lg font-medium mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first workflow to get started
              </p>
              <Button
                onClick={onCreateBlankWorkflow}
                data-testid="button-create-first-project"
              >
                <Plus size={16} className="mr-2" />
                Create Project
              </Button>
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={!!deleteProjectId}
          onOpenChange={(open) => !open && setDeleteProjectId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{projectToDelete?.name}"? This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">
                Cancel
              </AlertDialogCancel>
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
      </>
    );
  }

  // Main Home View
  return (
    <>
    {CursorTooltip}
    <div className="flex-1 overflow-auto bg-background relative">
      <Suspense fallback={null}>
        <FloatingShapes />
      </Suspense>
      <div className="relative z-10 max-w-5xl mx-auto px-6 pb-8">
        {/* Zero Credits Warning Banner */}
        {showZeroCreditsWarning && (
          <div
            className="mb-6 mt-6 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4 flex items-center gap-3"
            data-testid="banner-zero-credits"
          >
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                You've run out of free trial credits
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                Create an account to get monthly credits and unlock the full
                power of KiteAI.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("openSignUp"))
              }
              data-testid="button-signup-banner"
            >
              Sign Up Free
            </Button>
          </div>
        )}

        {/* AI Hero Section */}
        <HomeHero
          onStartDesigning={handleStartDesigning}
          onImportFigma={undefined /* Intentionally disabled — restore `onImportFigma ? handleImportFigmaWithGate : undefined` to re-enable */}
          onUploadImage={handleUploadImageWithGate}
          isGenerating={isGenerating}
          isDisabled={isOutOfCredits}
          isImageLocked={!canUploadImage}
        />

        {/* Recent Projects Section */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold mb-4">Recent Projects</h2>

          {!isUserAuthenticated ? (
            /* Promo Card for Non-Authenticated Users */
            <div
              className="rounded-xl p-6"
              style={{
                background:
                  "linear-gradient(135deg, rgba(147, 51, 234, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)",
              }}
              data-testid="promo-signup-card"
            >
              <h3 className="text-base font-semibold text-foreground mb-2">
                Sign up for a Pro Account to save your projects
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                Want to save your projects so it's easy to pick back up where
                you left off? Create a Pro account to get access to cloud
                storage, increased tokens, and more!
              </p>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("openSignIn"))
                  }
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                  data-testid="button-signin-promo"
                >
                  Sign in
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("openSignUp"))
                  }
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
                {recentProjects
                  .slice(0, 6)
                  .map((project) => renderProjectCard(project))}
              </div>
            </>
          ) : (
            /* Authenticated User with No Projects */
            <div className="text-center py-8 bg-muted/30 rounded-lg">
              <Workflow
                size={32}
                className="mx-auto text-muted-foreground/50 mb-2"
              />
              <p className="text-muted-foreground text-sm">
                No projects yet. Create your first workflow above!
              </p>
            </div>
          )}
        </div>


        {/* Delete Confirmation Dialog (for home view) */}
        <AlertDialog
          open={!!deleteProjectId}
          onOpenChange={(open) => !open && setDeleteProjectId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{projectToDelete?.name}"? This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">
                Cancel
              </AlertDialogCancel>
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
        <div>
          <h2 className="text-lg font-semibold mb-4">Quick Start Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflowTemplates.map((template) => {
              const IconComponent =
                categoryIcons[template.category] || Workflow;
              return (
                <button
                  type="button"
                  key={template.id}
                  className="text-left w-full rounded-lg border bg-card text-card-foreground shadow-sm transition-colors group cursor-pointer hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  onClick={() => handleTemplateClick(template)}
                  data-testid={`card-template-${template.id}`}
                >
                  <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 rounded-t-lg overflow-hidden flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
                        <IconComponent size={24} className="text-primary" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {template.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium">{template.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {template.description}
                    </p>
                    <div className="mt-2 pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        by {template.author}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
    </>
  );
}
