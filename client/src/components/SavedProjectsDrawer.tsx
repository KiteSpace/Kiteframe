import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Cloud, FolderOpen, Save, Trash2, MoreVertical, Loader2, Crown, Lock, Clock, Edit2 } from 'lucide-react';
import type { SavedProject } from '@shared/schema';
import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';

interface WorkflowData {
  nodes: Node[];
  edges: Edge[];
  canvasObjects: CanvasObject[];
  viewport: { x: number; y: number; zoom: number };
  metadata?: {
    name: string;
    description: string;
    links: Array<{ id: string; text: string; url: string }>;
    linksFormat: 'bulleted' | 'text';
    categories: string[];
  };
}

interface SavedProjectsDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentWorkflow: WorkflowData;
  onLoadProject: (workflowData: WorkflowData) => void;
  isPro: boolean;
  isAuthenticated: boolean;
}

export function SavedProjectsDrawer({
  isOpen,
  onOpenChange,
  currentWorkflow,
  onLoadProject,
  isPro,
  isAuthenticated,
}: SavedProjectsDrawerProps) {
  const { toast } = useToast();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<SavedProject | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const { data: projectsResponse, isLoading } = useQuery<{ projects: SavedProject[] }>({
    queryKey: ['/api/projects'],
    enabled: isOpen && isAuthenticated,
  });

  const projects = projectsResponse?.projects || [];

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; workflowData: WorkflowData }) => {
      return apiRequest('POST', '/api/projects', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setSaveDialogOpen(false);
      setProjectName('');
      setProjectDescription('');
      toast({
        title: 'Project Saved',
        description: 'Your workflow has been saved to the cloud.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save project.',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; workflowData?: WorkflowData }) => {
      return apiRequest('PUT', `/api/projects/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setEditingProject(null);
      toast({
        title: 'Project Updated',
        description: 'Your project has been updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update project.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/projects/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: 'Project Deleted',
        description: 'Your project has been deleted.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete project.',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    if (!projectName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for your project.',
        variant: 'destructive',
      });
      return;
    }
    saveMutation.mutate({
      name: projectName,
      description: projectDescription,
      workflowData: currentWorkflow,
    });
  };

  const handleLoad = (project: SavedProject) => {
    const workflowData = project.workflowData as WorkflowData;
    onLoadProject(workflowData);
    onOpenChange(false);
    toast({
      title: 'Project Loaded',
      description: `Loaded "${project.name}" from the cloud.`,
    });
  };

  const handleUpdate = (project: SavedProject) => {
    updateMutation.mutate({
      id: project.id,
      workflowData: currentWorkflow,
    });
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isAuthenticated) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Cloud Projects
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
            <Lock className="h-16 w-16 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Sign In Required</h3>
            <p className="text-muted-foreground max-w-[280px]">
              Sign in to access cloud-saved projects and sync your workflows across devices.
            </p>
            <Button onClick={() => window.location.href = '/account'} data-testid="button-sign-in-prompt">
              Sign In
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }


  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Cloud Projects
            <Badge variant="secondary" className="ml-2">Pro</Badge>
          </SheetTitle>
          <SheetDescription>
            Save and load your workflows from the cloud
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" data-testid="button-save-new-project">
                <Save className="h-4 w-4 mr-2" />
                Save Current Workflow
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Project to Cloud</DialogTitle>
                <DialogDescription>
                  Give your project a name and description to save it.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label htmlFor="project-name" className="text-sm font-medium">
                    Project Name
                  </label>
                  <Input
                    id="project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="My Awesome Workflow"
                    data-testid="input-project-name"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="project-description" className="text-sm font-medium">
                    Description (optional)
                  </label>
                  <Textarea
                    id="project-description"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Describe your workflow..."
                    rows={3}
                    data-testid="input-project-description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  data-testid="button-confirm-save"
                >
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Project
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Your Projects ({projects.length})
            </h4>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Cloud className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No saved projects yet</p>
                <p className="text-sm">Save your first workflow to the cloud!</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3 pr-4">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                      data-testid={`project-card-${project.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium truncate" data-testid={`project-name-${project.id}`}>
                            {project.name}
                          </h5>
                          {project.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {project.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDate(project.updatedAt)}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleLoad(project)} data-testid={`action-load-${project.id}`}>
                              <FolderOpen className="h-4 w-4 mr-2" />
                              Load
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate(project)} data-testid={`action-update-${project.id}`}>
                              <Save className="h-4 w-4 mr-2" />
                              Update with Current
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditingProject(project)} data-testid={`action-edit-${project.id}`}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit Details
                            </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-destructive"
                                  data-testid={`action-delete-${project.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete "{project.name}". This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(project.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    data-testid={`confirm-delete-${project.id}`}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLoad(project)}
                          className="flex-1"
                          data-testid={`button-load-${project.id}`}
                        >
                          <FolderOpen className="h-3 w-3 mr-1" />
                          Load
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        {editingProject && (
          <Dialog open={!!editingProject} onOpenChange={() => setEditingProject(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Project Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label htmlFor="edit-name" className="text-sm font-medium">
                    Project Name
                  </label>
                  <Input
                    id="edit-name"
                    defaultValue={editingProject.name}
                    onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                    data-testid="input-edit-project-name"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="edit-description" className="text-sm font-medium">
                    Description
                  </label>
                  <Textarea
                    id="edit-description"
                    defaultValue={editingProject.description || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                    rows={3}
                    data-testid="input-edit-project-description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingProject(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => updateMutation.mutate({
                    id: editingProject.id,
                    name: editingProject.name,
                    description: editingProject.description || undefined,
                  })}
                  disabled={updateMutation.isPending}
                  data-testid="button-confirm-edit"
                >
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </SheetContent>
    </Sheet>
  );
}
