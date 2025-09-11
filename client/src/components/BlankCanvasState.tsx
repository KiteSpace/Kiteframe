import { FileText, Sparkles, Upload, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface BlankCanvasStateProps {
  onCreateBlank: () => void;
  onCreateWithTemplate: () => void;
  onCreateWithAI: () => void;
  onImportWorkflow: () => void;
}

export function BlankCanvasState({
  onCreateBlank,
  onCreateWithTemplate,
  onCreateWithAI,
  onImportWorkflow
}: BlankCanvasStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-background/50 p-8">
      <div className="max-w-lg mx-auto text-center space-y-8">
        {/* Welcome Message */}
        <div className="space-y-4">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
            <FileText className="w-12 h-12 text-primary/60" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Welcome to KiteFrame
            </h2>
            <p className="text-muted-foreground">
              Create your first workflow to start building amazing automation flows
            </p>
          </div>
        </div>

        {/* Creation Options */}
        <div className="grid gap-3">
          <Card className="transition-all hover:shadow-md hover:scale-[1.02]">
            <CardContent className="p-4">
              <Button
                onClick={onCreateBlank}
                variant="ghost"
                className="w-full h-auto p-4 flex items-start space-x-4 text-left"
                data-testid="button-create-blank"
              >
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="font-medium">Create Blank Workflow</div>
                  <div className="text-sm text-muted-foreground">
                    Start with an empty canvas and build from scratch
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-all hover:shadow-md hover:scale-[1.02]">
            <CardContent className="p-4">
              <Button
                onClick={onCreateWithTemplate}
                variant="ghost"
                className="w-full h-auto p-4 flex items-start space-x-4 text-left"
                data-testid="button-create-template"
              >
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="font-medium">Use Template</div>
                  <div className="text-sm text-muted-foreground">
                    Start with a pre-built workflow template
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-all hover:shadow-md hover:scale-[1.02]">
            <CardContent className="p-4">
              <Button
                onClick={onCreateWithAI}
                variant="ghost"
                className="w-full h-auto p-4 flex items-start space-x-4 text-left"
                data-testid="button-create-ai"
              >
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="font-medium">Generate with AI</div>
                  <div className="text-sm text-muted-foreground">
                    Describe your workflow and let AI create it
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-all hover:shadow-md hover:scale-[1.02]">
            <CardContent className="p-4">
              <Button
                onClick={onImportWorkflow}
                variant="ghost"
                className="w-full h-auto p-4 flex items-start space-x-4 text-left"
                data-testid="button-import-workflow"
              >
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                  <Upload className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="font-medium">Import Workflow</div>
                  <div className="text-sm text-muted-foreground">
                    Import an existing workflow from a file
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Tip */}
        <div className="text-xs text-muted-foreground border-t pt-4">
          💡 Tip: You can also use the sidebar tools to create workflows once you have an active tab
        </div>
      </div>
    </div>
  );
}