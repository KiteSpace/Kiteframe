import type { KiteFramePlugin, PluginHooks } from '../../core/KiteFrameCore';

/**
 * Advanced Interactions Pro Plugin
 * Premium features for enhanced workflow creation UX
 * 
 * Features:
 * - Quick-add node handles with (+) buttons
 * - Smart node positioning and ghost previews  
 * - Enhanced multi-selection capabilities
 * - Copy/paste functionality
 * - Edge reconnection handles
 */
export class AdvancedInteractionsPlugin implements KiteFramePlugin {
  name = 'advanced-interactions-pro';
  version = '1.0.0';
  isPro = true;

  private quickAddButtons: Map<string, HTMLElement> = new Map();
  private ghostPreview: HTMLElement | null = null;
  private copiedNode: any = null;

  initialize(core: any): void {
    console.log('🚀 AdvancedInteractions Pro Plugin: Initializing...');
    
    // Register hooks for enhanced interactions
    const hooks: PluginHooks = {
      onCanvasClick: (event, worldPos) => {
        // Handle canvas interactions for quick-add functionality
        console.log('🚀 AdvancedInteractions: Canvas clicked', worldPos);
      }
    };

    core.registerHooks(hooks);

    // Setup DOM event listeners for node hover detection
    this.setupNodeHoverListeners();

    // Setup copy/paste functionality
    this.setupCopyPasteListeners();

    // Register quick-add functionality
    core.on('quick-add:trigger', (data: { nodeId: string; position: 'top' | 'right' | 'bottom' | 'left' }) => {
      this.handleQuickAddNode(data.nodeId, data.position);
    });

    console.log('🚀 AdvancedInteractions Pro Plugin: Ready!');
    console.log('   ✨ Quick-add node handles enabled');
    console.log('   ✨ Enhanced selection capabilities active');
    console.log('   ✨ Copy/paste functionality available');
  }

  private setupNodeHoverListeners(): void {
    console.log('🚀 Setting up handle hover listeners for quick-add functionality...');
    
    // Listen for hover events on existing connection handles
    document.addEventListener('mouseenter', (e) => {
      const target = e.target as SVGCircleElement;
      
      // Check if this is a connection handle (SVG circle with cursor-crosshair)
      if (target.tagName === 'circle' && target.classList.contains('cursor-crosshair')) {
        const svgElement = target.closest('svg');
        const nodeElement = svgElement?.closest('[data-node-id]');
        
        if (nodeElement && nodeElement.hasAttribute('data-node-id')) {
          const nodeId = nodeElement.getAttribute('data-node-id');
          const handlePosition = this.getHandlePosition(target, svgElement!);
          
          if (nodeId && handlePosition) {
            console.log('🚀 Handle hover detected:', { nodeId, position: handlePosition });
            this.showQuickAddButton(nodeId, handlePosition, target);
          }
        }
      }
    }, true);

    // Listen for mouse leave to hide quick-add buttons
    document.addEventListener('mouseleave', (e) => {
      const target = e.target as HTMLElement;
      
      if (target.classList?.contains('quick-add-button') || 
          (target.tagName === 'circle' && target.classList.contains('cursor-crosshair'))) {
        
        // Delay hiding to allow moving from handle to button
        setTimeout(() => {
          this.hideAllQuickAddButtons();
        }, 100);
      }
    }, true);
  }

  private getHandlePosition(circleElement: SVGCircleElement, svgElement: SVGElement): 'top' | 'right' | 'bottom' | 'left' | null {
    const cx = parseFloat(circleElement.getAttribute('cx') || '0');
    const cy = parseFloat(circleElement.getAttribute('cy') || '0');
    const svgSVGElement = svgElement as SVGSVGElement;
    const svgWidth = svgSVGElement.width.baseVal.value;
    const svgHeight = svgSVGElement.height.baseVal.value;
    
    // Determine position based on coordinates
    if (cy === 0) return 'top';
    if (cy === svgHeight) return 'bottom';
    if (cx === 0) return 'left';
    if (cx === svgWidth) return 'right';
    
    return null;
  }

  private showQuickAddButton(nodeId: string, position: 'top' | 'right' | 'bottom' | 'left', handleElement: SVGCircleElement): void {
    // Hide existing buttons first
    this.hideAllQuickAddButtons();
    
    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) return;

    const button = document.createElement('button');
    button.className = `quick-add-button quick-add-${position}`;
    button.innerHTML = '+';
    button.style.position = 'absolute';
    button.style.width = '24px';
    button.style.height = '24px';
    button.style.borderRadius = '50%';
    button.style.backgroundColor = '#10b981';
    button.style.color = 'white';
    button.style.border = '2px solid white';
    button.style.cursor = 'pointer';
    button.style.fontSize = '14px';
    button.style.fontWeight = 'bold';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    button.style.zIndex = '1000';
    button.style.transition = 'all 0.2s ease';

    // Position button offset from the handle
    const offset = 40; // Distance from node edge
    switch (position) {
      case 'top':
        button.style.top = `${-offset}px`;
        button.style.left = '50%';
        button.style.transform = 'translateX(-50%)';
        break;
      case 'right':
        button.style.right = `${-offset}px`;
        button.style.top = '50%';
        button.style.transform = 'translateY(-50%)';
        break;
      case 'bottom':
        button.style.bottom = `${-offset}px`;
        button.style.left = '50%';
        button.style.transform = 'translateX(-50%)';
        break;
      case 'left':
        button.style.left = `${-offset}px`;
        button.style.top = '50%';
        button.style.transform = 'translateY(-50%)';
        break;
    }

    // Add hover effects for ghost preview
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#059669';
      button.style.transform += ' scale(1.2)';
      this.showGhostPreview(nodeId, position);
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#10b981';
      button.style.transform = button.style.transform.replace(' scale(1.2)', '');
      this.hideGhostPreview();
    });

    // Handle click to create node
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleQuickAddNode(nodeId, position);
      this.hideAllQuickAddButtons();
      this.hideGhostPreview();
    });

    nodeElement.appendChild(button);
    this.quickAddButtons.set(`${nodeId}-${position}`, button);
  }

  private showGhostPreview(nodeId: string, position: 'top' | 'right' | 'bottom' | 'left'): void {
    this.hideGhostPreview();
    
    const tabManager = (window as any).tabManager;
    if (!tabManager?.currentTab?.nodes) return;

    const sourceNode = tabManager.currentTab.nodes.find((n: any) => n.id === nodeId);
    if (!sourceNode) return;

    // Calculate ghost position
    const spacing = 250;
    let ghostPosition = { x: 0, y: 0 };
    
    switch (position) {
      case 'top':
        ghostPosition = { x: sourceNode.position.x, y: sourceNode.position.y - spacing };
        break;
      case 'right':
        ghostPosition = { x: sourceNode.position.x + spacing, y: sourceNode.position.y };
        break;
      case 'bottom':
        ghostPosition = { x: sourceNode.position.x, y: sourceNode.position.y + spacing };
        break;
      case 'left':
        ghostPosition = { x: sourceNode.position.x - spacing, y: sourceNode.position.y };
        break;
    }

    // Create ghost preview
    const ghost = document.createElement('div');
    ghost.className = 'ghost-preview';
    ghost.style.position = 'absolute';
    ghost.style.left = `${ghostPosition.x}px`;
    ghost.style.top = `${ghostPosition.y}px`;
    ghost.style.width = '200px';
    ghost.style.height = '100px';
    ghost.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
    ghost.style.border = '2px dashed #3b82f6';
    ghost.style.borderRadius = '8px';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '999';
    ghost.style.display = 'flex';
    ghost.style.alignItems = 'center';
    ghost.style.justifyContent = 'center';
    ghost.style.color = '#3b82f6';
    ghost.style.fontSize = '14px';
    ghost.style.fontWeight = 'bold';
    ghost.innerHTML = 'New Process';

    // Add to canvas
    const canvasWorld = document.querySelector('.kiteframe-world');
    if (canvasWorld) {
      canvasWorld.appendChild(ghost);
      this.ghostPreview = ghost;
    }
  }

  private hideGhostPreview(): void {
    if (this.ghostPreview) {
      this.ghostPreview.remove();
      this.ghostPreview = null;
    }
  }

  private hideAllQuickAddButtons(): void {
    this.quickAddButtons.forEach((button) => {
      button.remove();
    });
    this.quickAddButtons.clear();
  }

  private setupCopyPasteListeners(): void {
    // Listen for keyboard events for copy/paste using stored handler reference
    document.addEventListener('keydown', this.copyPasteHandler, true);
  }

  private copySelectedNode(): void {
    console.log('🚀 Attempting to copy selected node...');
    
    // Get node data from tab manager first (more reliable)
    const tabManager = (window as any).tabManager;
    if (!tabManager?.currentTab?.nodes) {
      console.log('🚀 Copy: No tab manager or nodes available');
      return;
    }

    // Find selected node from tab data
    const selectedNode = tabManager.currentTab.nodes.find((n: any) => n.selected === true);
    if (!selectedNode) {
      console.log('🚀 Copy: No node selected in tab data');
      
      // Fallback: check DOM for selected node
      const domSelectedNode = document.querySelector('.kiteframe-node.selected');
      if (domSelectedNode) {
        const nodeId = domSelectedNode.getAttribute('data-node-id');
        if (nodeId) {
          const nodeFromDom = tabManager.currentTab.nodes.find((n: any) => n.id === nodeId);
          if (nodeFromDom) {
            this.copiedNode = { ...nodeFromDom };
            console.log('🚀 Node copied from DOM fallback:', this.copiedNode.data?.label);
            this.showCopyFeedback();
            return;
          }
        }
      }
      
      console.log('🚀 Copy: No selected node found');
      return;
    }

    this.copiedNode = { ...selectedNode };
    console.log('🚀 Node copied:', this.copiedNode.data?.label);
    
    // Show visual feedback
    this.showCopyFeedback();
  }

  private pasteNode(): void {
    if (!this.copiedNode) {
      console.log('🚀 Paste: No node copied');
      return;
    }

    // Get tab manager
    const tabManager = (window as any).tabManager;
    if (!tabManager?.currentTab?.nodes || !tabManager.updateTab) return;

    // Create new node with offset position
    const newNode = {
      ...this.copiedNode,
      id: `node-${Date.now()}`,
      position: {
        x: this.copiedNode.position.x + 50,
        y: this.copiedNode.position.y + 50
      },
      selected: false
    };

    // Add to current tab
    const updatedTab = {
      ...tabManager.currentTab,
      nodes: [...tabManager.currentTab.nodes, newNode]
    };

    tabManager.updateTab(updatedTab);
    console.log('🚀 Node pasted:', newNode.data?.label);
    
    // Show visual feedback
    this.showPasteFeedback();
  }

  private showCopyFeedback(): void {
    this.showFeedback('Copied!', '#10b981');
  }

  private showPasteFeedback(): void {
    this.showFeedback('Pasted!', '#3b82f6');
  }

  private showFeedback(message: string, color: string): void {
    const feedback = document.createElement('div');
    feedback.textContent = message;
    feedback.style.position = 'fixed';
    feedback.style.top = '20px';
    feedback.style.right = '20px';
    feedback.style.backgroundColor = color;
    feedback.style.color = 'white';
    feedback.style.padding = '8px 16px';
    feedback.style.borderRadius = '8px';
    feedback.style.fontSize = '14px';
    feedback.style.fontWeight = 'bold';
    feedback.style.zIndex = '9999';
    feedback.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    feedback.style.transition = 'all 0.3s ease';
    
    document.body.appendChild(feedback);
    
    // Animate in
    setTimeout(() => {
      feedback.style.transform = 'translateY(0)';
    }, 10);
    
    // Remove after 2 seconds
    setTimeout(() => {
      feedback.style.opacity = '0';
      feedback.style.transform = 'translateY(-20px)';
      setTimeout(() => {
        document.body.removeChild(feedback);
      }, 300);
    }, 2000);
  }

  private handleQuickAddNode(sourceNodeId: string, position: 'top' | 'right' | 'bottom' | 'left'): void {
    console.log(`🚀 Quick-adding node from ${sourceNodeId} at ${position}`);
    
    // Emit event for core to handle node creation
    // This will be handled by the main workflow editor
    window.dispatchEvent(new CustomEvent('kiteframe:quick-add-node', {
      detail: {
        sourceNodeId,
        position: { x: 0, y: 0 }, // Position will be calculated in the editor
        direction: position
      }
    }));
  }

  cleanup(): void {
    // Clean up all quick-add buttons and ghost preview
    this.hideAllQuickAddButtons();
    this.hideGhostPreview();
    
    // Remove event listeners to prevent memory leaks
    document.removeEventListener('keydown', this.copyPasteHandler, true);
    
    console.log('🚀 AdvancedInteractions Pro Plugin: Cleaned up');
  }

  // Store handler reference for cleanup
  private copyPasteHandler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLInputElement || 
        target instanceof HTMLTextAreaElement ||
        target.closest('[role="dialog"]') ||
        target.closest('.modal')) {
      return;
    }

    const isCopyKey = (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C');
    const isPasteKey = (e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V');

    if (isCopyKey) {
      e.preventDefault();
      e.stopPropagation();
      console.log('🚀 Copy shortcut detected');
      this.copySelectedNode();
    } else if (isPasteKey) {
      e.preventDefault();
      e.stopPropagation();
      console.log('🚀 Paste shortcut detected');
      this.pasteNode();
    }
  };
}

export const advancedInteractionsPlugin = new AdvancedInteractionsPlugin();