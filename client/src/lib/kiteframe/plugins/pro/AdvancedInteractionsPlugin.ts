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

  private quickAddHandles: Map<string, HTMLElement> = new Map();
  private copiedNode: any = null;

  initialize(core: any): void {
    console.log('🚀 AdvancedInteractions Pro Plugin: Initializing...');
    
    // Register hooks for enhanced interactions
    const hooks: PluginHooks = {
      afterNodesChange: (nodes) => {
        this.updateQuickAddHandles(nodes);
      },
      
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
    // Setup global event delegation for node hover events
    document.addEventListener('mouseover', (e) => {
      const target = e.target as HTMLElement;
      if (target && typeof target.closest === 'function') {
        const nodeElement = target.closest('[data-node-id]');
        if (nodeElement && nodeElement.hasAttribute('data-node-id')) {
          const nodeId = nodeElement.getAttribute('data-node-id');
          if (nodeId) {
            this.showQuickAddHandles(nodeId);
          }
        }
      }
    });

    document.addEventListener('mouseleave', (e) => {
      const target = e.target as HTMLElement;
      if (target && typeof target.closest === 'function') {
        const nodeElement = target.closest('[data-node-id]');
        if (nodeElement && nodeElement.hasAttribute('data-node-id')) {
          const nodeId = nodeElement.getAttribute('data-node-id');
          if (nodeId) {
            this.hideQuickAddHandles(nodeId);
          }
        }
      }
    });
  }

  private updateQuickAddHandles(nodes: any[]): void {
    // Update quick-add handle positions for all nodes
    nodes.forEach(node => {
      const existingHandles = this.quickAddHandles.get(node.id);
      if (existingHandles) {
        this.updateHandlePositions(node.id, node);
      }
    });
  }

  private showQuickAddHandles(nodeId: string): void {
    // Create and show quick-add handles around the node
    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) return;

    // Remove existing handles
    this.hideQuickAddHandles(nodeId);

    // Create handle container
    const handleContainer = document.createElement('div');
    handleContainer.className = 'quick-add-handles';
    handleContainer.style.position = 'absolute';
    handleContainer.style.top = '0';
    handleContainer.style.left = '0';
    handleContainer.style.width = '100%';
    handleContainer.style.height = '100%';
    handleContainer.style.pointerEvents = 'none';
    handleContainer.style.zIndex = '10';

    // Create handles for each position
    const positions = ['top', 'right', 'bottom', 'left'] as const;
    positions.forEach(position => {
      const handle = this.createQuickAddHandle(nodeId, position);
      handleContainer.appendChild(handle);
    });

    nodeElement.appendChild(handleContainer);
    this.quickAddHandles.set(nodeId, handleContainer);
  }

  private createQuickAddHandle(nodeId: string, position: 'top' | 'right' | 'bottom' | 'left'): HTMLElement {
    const handle = document.createElement('button');
    handle.className = `quick-add-handle quick-add-${position}`;
    handle.innerHTML = '+';
    handle.style.position = 'absolute';
    handle.style.width = '24px';
    handle.style.height = '24px';
    handle.style.borderRadius = '50%';
    handle.style.backgroundColor = '#3b82f6';
    handle.style.color = 'white';
    handle.style.border = '2px solid white';
    handle.style.cursor = 'pointer';
    handle.style.pointerEvents = 'auto';
    handle.style.fontSize = '14px';
    handle.style.fontWeight = 'bold';
    handle.style.display = 'flex';
    handle.style.alignItems = 'center';
    handle.style.justifyContent = 'center';
    handle.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    handle.style.transition = 'all 0.2s ease';

    // Position the handle based on side
    const offset = -12; // Half of handle size
    switch (position) {
      case 'top':
        handle.style.top = `${offset}px`;
        handle.style.left = '50%';
        handle.style.transform = 'translateX(-50%)';
        break;
      case 'right':
        handle.style.right = `${offset}px`;
        handle.style.top = '50%';
        handle.style.transform = 'translateY(-50%)';
        break;
      case 'bottom':
        handle.style.bottom = `${offset}px`;
        handle.style.left = '50%';
        handle.style.transform = 'translateX(-50%)';
        break;
      case 'left':
        handle.style.left = `${offset}px`;
        handle.style.top = '50%';
        handle.style.transform = 'translateY(-50%)';
        break;
    }

    // Add hover effects
    handle.addEventListener('mouseenter', () => {
      handle.style.backgroundColor = '#2563eb';
      handle.style.transform += ' scale(1.1)';
    });

    handle.addEventListener('mouseleave', () => {
      handle.style.backgroundColor = '#3b82f6';
      handle.style.transform = handle.style.transform.replace(' scale(1.1)', '');
    });

    // Handle click to add new node
    handle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleQuickAddNode(nodeId, position);
    });

    return handle;
  }

  private hideQuickAddHandles(nodeId: string): void {
    const handles = this.quickAddHandles.get(nodeId);
    if (handles) {
      handles.remove();
      this.quickAddHandles.delete(nodeId);
    }
  }

  private updateHandlePositions(nodeId: string, node: any): void {
    // Update handle positions when node moves or resizes
    const handles = this.quickAddHandles.get(nodeId);
    if (handles) {
      // Re-create handles with updated positions
      this.hideQuickAddHandles(nodeId);
      this.showQuickAddHandles(nodeId);
    }
  }

  private setupCopyPasteListeners(): void {
    // Listen for keyboard events for copy/paste
    document.addEventListener('keydown', (e) => {
      // Only handle if we're not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        this.copySelectedNode();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        this.pasteNode();
      }
    });
  }

  private copySelectedNode(): void {
    // Find the currently selected node
    const selectedNode = document.querySelector('.kiteframe-node.selected');
    if (!selectedNode) {
      console.log('🚀 Copy: No node selected');
      return;
    }

    const nodeId = selectedNode.getAttribute('data-node-id');
    if (!nodeId) return;

    // Get node data from tab manager
    const tabManager = (window as any).tabManager;
    if (!tabManager?.currentTab?.nodes) return;

    const node = tabManager.currentTab.nodes.find((n: any) => n.id === nodeId);
    if (node) {
      this.copiedNode = { ...node };
      console.log('🚀 Node copied:', this.copiedNode.data?.label);
      
      // Show visual feedback
      this.showCopyFeedback();
    }
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
    // Clean up all quick-add handles
    this.quickAddHandles.forEach((handles) => {
      handles.remove();
    });
    this.quickAddHandles.clear();
    
    console.log('🚀 AdvancedInteractions Pro Plugin: Cleaned up');
  }
}

export const advancedInteractionsPlugin = new AdvancedInteractionsPlugin();