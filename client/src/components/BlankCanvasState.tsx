import { FileText, Sparkles, Upload, Plus, Zap, Grid3X3, Bot } from 'lucide-react';
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
    <div className="flex-1 bg-background p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Create New Workflow</h1>
          <p className="text-muted-foreground text-lg">Choose how you'd like to start building your automation</p>
        </div>

        {/* Quick Start Section */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-6">Quick Start</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card 
              className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2 hover:border-blue-200 dark:hover:border-blue-800"
              onClick={onCreateBlank}
            >
              <CardContent className="p-8">
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Plus className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      Blank Workflow
                    </h3>
                    <p className="text-muted-foreground text-base leading-relaxed">
                      Start with an empty canvas and build your workflow from scratch with full creative control.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2 hover:border-green-200 dark:hover:border-green-800"
              onClick={onCreateWithTemplate}
            >
              <CardContent className="p-8">
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Grid3X3 className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                      Template
                    </h3>
                    <p className="text-muted-foreground text-base leading-relaxed">
                      Choose from pre-built workflow templates to jumpstart your automation projects.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* AI & Import Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-6">AI & Import</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card 
              className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2 hover:border-purple-200 dark:hover:border-purple-800"
              onClick={onCreateWithAI}
            >
              <CardContent className="p-8">
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      AI Generation
                    </h3>
                    <p className="text-muted-foreground text-base leading-relaxed">
                      Describe your workflow in plain language and let AI create the structure for you.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2 hover:border-orange-200 dark:hover:border-orange-800"
              onClick={onImportWorkflow}
            >
              <CardContent className="p-8">
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Upload className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      Import Workflow
                    </h3>
                    <p className="text-muted-foreground text-base leading-relaxed">
                      Import an existing workflow from a JSON file or another source.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}