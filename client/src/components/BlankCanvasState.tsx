import { FileText, Sparkles, Upload, Plus, Zap, Grid3X3, Bot, Users, MapPin, Server, Layers, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface BlankCanvasStateProps {
  onCreateBlank: () => void;
  onCreateWithTemplate: () => void;
  onCreateWithAI: () => void;
  onImportWorkflow: () => void;
  onCreateTemplate?: (templateType: string) => void;
}

export function BlankCanvasState({
  onCreateBlank,
  onCreateWithTemplate,
  onCreateWithAI,
  onImportWorkflow,
  onCreateTemplate
}: BlankCanvasStateProps) {
  const handleTemplateCreate = (templateType: string) => {
    console.log('🎯 BLANK CANVAS TEMPLATE CLICKED:', { templateType, hasOnCreateTemplate: !!onCreateTemplate });
    
    // If we have the template creation function, use it, otherwise fall back to blank
    if (onCreateTemplate) {
      console.log('🎯 CALLING onCreateTemplate with:', templateType);
      onCreateTemplate(templateType);
    } else {
      console.log('🎯 No onCreateTemplate, falling back to blank');
      onCreateBlank();
    }
  };

  return (
    <div className="flex-1 bg-background p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Create New Workflow</h1>
          <p className="text-muted-foreground text-md">Choose how you'd like to start building your automation</p>
        </div>

        {/* Fresh Start Section */}
        <div className="mb-12">
          <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6 block">Fresh Start</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card 
              className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border hover:border-muted-foreground/20"
              onClick={onCreateBlank}
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <Plus className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-foreground mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      Blank Workflow
                    </h3>
                    <p className="text-muted-foreground text-md leading-relaxed">
                      Start with an empty canvas and build from scratch
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border hover:border-muted-foreground/20"
              onClick={onCreateWithAI}
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <Bot className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-foreground mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      AI Generation
                    </h3>
                    <p className="text-muted-foreground text-md leading-relaxed">
                      Describe your workflow and let AI create it
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border hover:border-muted-foreground/20"
              onClick={onImportWorkflow}
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <Upload className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-foreground mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      Import Workflow
                    </h3>
                    <p className="text-muted-foreground text-md leading-relaxed">
                      Import an existing workflow from a file
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Start Templates Section */}
        <div className="mb-8">
          <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6 block">Quick Start Templates</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card 
              className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border hover:border-muted-foreground/20"
              onClick={() => handleTemplateCreate('user-journey')}
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <Users className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-foreground mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      User Journey
                    </h3>
                    <p className="text-muted-foreground text-md leading-relaxed">
                      Map user interactions and experience flows
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border hover:border-muted-foreground/20"
              onClick={() => handleTemplateCreate('mindmap')}
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <MapPin className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-foreground mb-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                      Mindmap
                    </h3>
                    <p className="text-muted-foreground text-md leading-relaxed">
                      Organize ideas and concepts visually
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border hover:border-muted-foreground/20"
              onClick={() => handleTemplateCreate('system-architecture')}
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <Server className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-foreground mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      System Architecture
                    </h3>
                    <p className="text-muted-foreground text-md leading-relaxed">
                      Design system components and connections
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border hover:border-muted-foreground/20"
              onClick={() => handleTemplateCreate('swim-lanes')}
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <Layers className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-foreground mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      Swim Lanes
                    </h3>
                    <p className="text-muted-foreground text-md leading-relaxed">
                      Organize processes by responsibility lanes
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border hover:border-muted-foreground/20"
              onClick={() => handleTemplateCreate('user-account-creation')}
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <UserPlus className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-foreground mb-1 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      User Account Creation
                    </h3>
                    <p className="text-muted-foreground text-md leading-relaxed">
                      Model user registration and onboarding flows
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border hover:border-muted-foreground/20"
              onClick={() => handleTemplateCreate('io-logic')}
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <Zap className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-foreground mb-1 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                      I/O Logic
                    </h3>
                    <p className="text-muted-foreground text-md leading-relaxed">
                      Design input/output processing workflows
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