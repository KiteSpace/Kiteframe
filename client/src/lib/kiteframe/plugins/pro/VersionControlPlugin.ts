import type { KiteFramePlugin } from '../../core/KiteFrameCore';

/**
 * Version Control Pro Plugin  
 * Advanced workflow versioning and history management
 * 
 * Features:
 * - Advanced history tracking beyond basic undo/redo
 * - Version comparison and visual diffs
 * - Rollback to any previous version
 * - Change detection and attribution
 * - Branch-like workflow versions
 * - Export/import specific versions
 */
export class VersionControlPlugin implements KiteFramePlugin {
  name = 'version-control-pro';
  version = '1.0.0';
  isPro = true;
  
  private core: any;
  private autoSaveInterval: number | null = null;

  initialize(core: any): void {
    this.core = core;
    
    // Store reference for global access
    (window as any).kiteframeVersionControlPlugin = this;
    
    // Add version control extension points
    this.setupExtensionPoints();
    
    // Setup auto-save snapshots every 2 minutes
    this.setupAutoSave();
    
    // Add version control UI elements
    this.setupVersionControlUI();
  }

  private setupExtensionPoints(): void {
    // Add snapshot creation capability on major changes
    this.core.on('nodes:changed', () => {
      this.debounceAutoSave();
    });
    
    this.core.on('edges:changed', () => {
      this.debounceAutoSave(); 
    });
  }

  private setupAutoSave(): void {
    // Auto-save snapshots every 2 minutes
    this.autoSaveInterval = window.setInterval(() => {
      this.createAutoSnapshot();
    }, 2 * 60 * 1000);
  }

  private debounceAutoSave = (() => {
    let timeout: number | null = null;
    return () => {
      if (timeout) clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        this.createAutoSnapshot();
      }, 10000); // 10 second debounce
    };
  })();

  private async createAutoSnapshot(): Promise<void> {
    try {
      const tabManager = (window as any).tabManager;
      if (!tabManager?.currentTab) return;

      const currentTab = tabManager.currentTab;
      const snapshotData = {
        workflowId: currentTab.id,
        name: `Auto-save ${new Date().toLocaleString()}`,
        description: 'Automatic snapshot',
        nodes: JSON.stringify(currentTab.nodes),
        edges: JSON.stringify(currentTab.edges),
        metadata: JSON.stringify({
          nodeCount: currentTab.nodes.length,
          edgeCount: currentTab.edges.length,
          autoSave: true
        }),
        isAutoSave: true
      };

      const response = await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshotData)
      });

    } catch (error) {
      console.error('Auto-snapshot failed:', error);
    }
  }

  async createSnapshot(name: string, description?: string): Promise<boolean> {
    try {
      const tabManager = (window as any).tabManager;
      if (!tabManager?.currentTab) return false;

      const currentTab = tabManager.currentTab;
      const snapshotData = {
        workflowId: currentTab.id,
        name,
        description: description || `Manual snapshot: ${name}`,
        nodes: JSON.stringify(currentTab.nodes),
        edges: JSON.stringify(currentTab.edges),
        metadata: JSON.stringify({
          nodeCount: currentTab.nodes.length,
          edgeCount: currentTab.edges.length,
          manualSave: true
        }),
        isAutoSave: false
      };

      const response = await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshotData)
      });

      if (response.ok) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Snapshot creation failed:', error);
      return false;
    }
  }

  async getSnapshots(workflowId: string): Promise<any[]> {
    try {
      const response = await fetch(`/api/snapshots/${workflowId}`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch snapshots:', error);
      return [];
    }
  }

  async restoreSnapshot(snapshotId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/snapshots/${snapshotId}/restore`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const snapshot = await response.json();
        const tabManager = (window as any).tabManager;
        
        if (tabManager?.currentTab) {
          // Restore the workflow state - handle both string and object data
          try {
            tabManager.currentTab.nodes = typeof snapshot.nodes === 'string' 
              ? JSON.parse(snapshot.nodes) 
              : snapshot.nodes;
            tabManager.currentTab.edges = typeof snapshot.edges === 'string' 
              ? JSON.parse(snapshot.edges) 
              : snapshot.edges;
            
            // Trigger refresh
            const event = new CustomEvent('workflow:restored', { detail: snapshot });
            window.dispatchEvent(event);
            
            return true;
          } catch (parseError) {
            console.error('Failed to parse snapshot data:', parseError);
            return false;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('Snapshot restore failed:', error);
      return false;
    }
  }

  public handleSnapshot(): void {
    const name = prompt('Enter snapshot name:');
    if (name) {
      this.createSnapshot(name);
    }
  }

  public handleVersionHistory(): void {
    this.showVersionHistory();
  }

  private setupVersionControlUI(): void {
    // UI is now handled by FloatingToolbar
  }

  private async showVersionHistory(): Promise<void> {
    const tabManager = (window as any).tabManager;
    if (!tabManager?.currentTab) return;

    const snapshots = await this.getSnapshots(tabManager.currentTab.id);
    
    // Create modal safely using DOM methods
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'version-history-modal';
    modalOverlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'bg-card border border-border rounded-lg p-6 max-w-2xl w-full m-4 max-h-96 overflow-y-auto';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-4';
    
    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold';
    title.textContent = 'Version History';
    
    const closeButton = document.createElement('button');
    closeButton.id = 'close-version-history';
    closeButton.className = 'text-muted-foreground hover:text-foreground';
    closeButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x">
        <path d="M18 6 6 18"/>
        <path d="M6 6l12 12"/>
      </svg>
    `;
    
    header.appendChild(title);
    header.appendChild(closeButton);
    
    // Create snapshots container
    const snapshotsContainer = document.createElement('div');
    snapshotsContainer.className = 'space-y-2';
    
    // Create snapshot items safely
    snapshots.forEach(snapshot => {
      const snapshotItem = document.createElement('div');
      snapshotItem.className = 'flex items-center justify-between p-3 border border-border rounded-lg';
      
      const infoDiv = document.createElement('div');
      
      const nameDiv = document.createElement('div');
      nameDiv.className = 'font-medium';
      nameDiv.textContent = snapshot.name; // Safe: uses textContent
      
      const dateDiv = document.createElement('div');
      dateDiv.className = 'text-sm text-muted-foreground';
      dateDiv.textContent = new Date(snapshot.createdAt).toLocaleString();
      
      infoDiv.appendChild(nameDiv);
      infoDiv.appendChild(dateDiv);
      
      if (snapshot.description) {
        const descDiv = document.createElement('div');
        descDiv.className = 'text-xs text-muted-foreground';
        descDiv.textContent = snapshot.description; // Safe: uses textContent
        infoDiv.appendChild(descDiv);
      }
      
      const restoreButton = document.createElement('button');
      restoreButton.className = 'px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90';
      restoreButton.textContent = 'Restore';
      restoreButton.addEventListener('click', () => {
        this.restoreSnapshot(snapshot.id);
      });
      
      snapshotItem.appendChild(infoDiv);
      snapshotItem.appendChild(restoreButton);
      snapshotsContainer.appendChild(snapshotItem);
    });
    
    // Assemble modal
    modalContent.appendChild(header);
    modalContent.appendChild(snapshotsContainer);
    modalOverlay.appendChild(modalContent);
    
    document.body.appendChild(modalOverlay);

    // Add close handler
    closeButton.addEventListener('click', () => {
      modalOverlay.remove();
    });

    // Expose this instance to window for button callbacks
    (window as any).versionControlPlugin = this;
  }

  cleanup(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }
}

export const versionControlPlugin = new VersionControlPlugin();