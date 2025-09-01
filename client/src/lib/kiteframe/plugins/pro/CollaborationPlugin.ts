import type { KiteFramePlugin } from '../../core/KiteFrameCore';

/**
 * Collaboration Pro Plugin
 * Real-time multi-user workflow editing capabilities
 * 
 * Features:
 * - Real-time room-based collaboration
 * - Live user presence and cursors
 * - Comment system (node-attached and canvas-positioned)
 * - Real-time chat within rooms
 * - Room isolation and management
 */
export class CollaborationPlugin implements KiteFramePlugin {
  name = 'collaboration-pro';
  version = '1.0.0';
  isPro = true;
  
  private core: any;
  private currentRoom: any = null;
  private websocket: WebSocket | null = null;
  private userPresence: Map<string, any> = new Map();

  initialize(core: any): void {
    this.core = core;
    console.log('🤝 Collaboration Pro Plugin: Initializing...');
    
    // Store reference for global access
    (window as any).kiteframeCollaborationPlugin = this;
    console.log('🤝 Global reference set:', !!(window as any).kiteframeCollaborationPlugin);
    
    // Setup collaboration UI
    this.setupCollaborationUI();
    
    // Setup WebSocket for real-time features
    this.setupWebSocket();
    
    // Setup comment system
    this.setupCommentSystem();
    
    console.log('   ✅ Room isolation enabled');
    console.log('   ✅ Real-time chat active');
    console.log('   ✅ Comment system ready');
    console.log('   ✅ User presence tracking');
    console.log('🤝 Collaboration Pro Plugin: Ready!');
  }

  private setupWebSocket(): void {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.websocket = new WebSocket(wsUrl);
    
    this.websocket.onopen = () => {
      console.log('🔗 Collaboration WebSocket connected');
    };
    
    this.websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleWebSocketMessage(data);
    };
    
    this.websocket.onclose = () => {
      console.log('🔗 Collaboration WebSocket disconnected');
      // Attempt reconnection after 3 seconds
      setTimeout(() => this.setupWebSocket(), 3000);
    };
  }

  private handleWebSocketMessage(data: any): void {
    switch (data.type) {
      case 'user_joined':
        this.handleUserJoined(data.user);
        break;
      case 'user_left':
        this.handleUserLeft(data.userId);
        break;
      case 'chat_message':
        this.handleChatMessage(data.message);
        break;
      case 'comment_added':
        this.handleCommentAdded(data.comment);
        break;
      case 'cursor_update':
        this.handleCursorUpdate(data.cursor);
        break;
    }
  }

  private handleUserJoined(user: any): void {
    this.userPresence.set(user.id, user);
    this.updatePresenceUI();
    console.log(`👋 ${user.firstName || 'User'} joined the collaboration`);
  }

  private handleUserLeft(userId: string): void {
    this.userPresence.delete(userId);
    this.updatePresenceUI();
    console.log(`👋 User left the collaboration`);
  }

  private handleChatMessage(message: any): void {
    this.addChatMessage(message);
  }

  private handleCommentAdded(comment: any): void {
    this.displayComment(comment);
  }

  private handleCursorUpdate(cursor: any): void {
    // Update live cursor position
    this.updateLiveCursor(cursor);
  }

  async createRoom(name: string, description?: string): Promise<string | null> {
    try {
      const roomData = {
        workflowId: 'current-workflow', // Get from context
        name,
        description: description || `Collaboration room: ${name}`,
        isPrivate: false
      };

      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roomData)
      });

      if (response.ok) {
        const room = await response.json();
        console.log(`🏠 Room "${name}" created successfully`);
        return room.id;
      }
      return null;
    } catch (error) {
      console.error('❌ Room creation failed:', error);
      return null;
    }
  }

  async joinRoom(roomId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST'
      });

      if (response.ok) {
        this.currentRoom = await response.json();
        
        // Notify WebSocket of room join
        if (this.websocket?.readyState === WebSocket.OPEN) {
          this.websocket.send(JSON.stringify({
            type: 'join_room',
            roomId: roomId
          }));
        }
        
        console.log(`🏠 Joined room: ${this.currentRoom.name}`);
        this.updateRoomUI();
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Room join failed:', error);
      return false;
    }
  }

  async sendChatMessage(message: string): Promise<void> {
    if (!this.currentRoom || !message.trim()) return;

    try {
      const messageData = {
        roomId: this.currentRoom.id,
        message: message.trim(),
        messageType: 'text'
      };

      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      });

      if (response.ok) {
        // Message will be broadcast via WebSocket
        const chatInput = document.getElementById('chat-input') as HTMLInputElement;
        if (chatInput) chatInput.value = '';
      }
    } catch (error) {
      console.error('❌ Chat message failed:', error);
    }
  }

  async addComment(content: string, nodeId?: string, positionX?: number, positionY?: number): Promise<void> {
    if (!this.currentRoom || !content.trim()) return;

    try {
      const commentData = {
        workflowId: 'current-workflow', // Get from context
        roomId: this.currentRoom.id,
        content: content.trim(),
        nodeId,
        positionX,
        positionY
      };

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData)
      });

      if (response.ok) {
        console.log('💬 Comment added successfully');
      }
    } catch (error) {
      console.error('❌ Comment failed:', error);
    }
  }

  private setupCollaborationUI(): void {
    const collaborationHTML = `
      <div id="collaboration-panel" class="fixed right-2 top-20 w-80 max-w-[calc(100vw-1rem)] bg-card border border-border rounded-lg shadow-lg z-50 sm:right-4 sm:top-4" style="display: none;">
        <!-- Room Controls -->
        <div class="p-4 border-b border-border">
          <div class="flex justify-between items-center mb-2">
            <h3 class="font-semibold">Collaboration</h3>
            <button id="close-collaboration" class="text-muted-foreground hover:text-foreground">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x">
                <path d="M18 6 6 18"/>
                <path d="M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="flex gap-2 mb-2">
            <input id="room-name" placeholder="Room name" class="flex-1 px-2 py-1 text-sm border border-border rounded" />
            <button id="create-room" class="px-3 py-1 bg-primary text-primary-foreground rounded text-sm">Create</button>
          </div>
          <div id="current-room" class="text-sm text-muted-foreground">Not in a room</div>
        </div>

        <!-- User Presence -->
        <div class="p-4 border-b border-border">
          <h4 class="text-sm font-medium mb-2">Online Users</h4>
          <div id="user-presence" class="space-y-1">
            <div class="text-xs text-muted-foreground">No users online</div>
          </div>
        </div>

        <!-- Chat -->
        <div class="p-4 border-b border-border">
          <h4 class="text-sm font-medium mb-2">Chat</h4>
          <div id="chat-messages" class="h-32 overflow-y-auto mb-2 space-y-1 text-xs">
            <div class="text-muted-foreground">No messages yet</div>
          </div>
          <div class="flex gap-2">
            <input id="chat-input" placeholder="Type a message..." class="flex-1 px-2 py-1 text-sm border border-border rounded" />
            <button id="send-chat" class="px-3 py-1 bg-primary text-primary-foreground rounded text-sm">Send</button>
          </div>
        </div>

        <!-- Comments -->
        <div class="p-4">
          <h4 class="text-sm font-medium mb-2">Add Comment</h4>
          <div class="flex gap-2">
            <input id="comment-input" placeholder="Add a comment..." class="flex-1 px-2 py-1 text-sm border border-border rounded" />
            <button id="add-comment" class="px-3 py-1 bg-primary text-primary-foreground rounded text-sm">Add</button>
          </div>
        </div>
      </div>


    `;

    // Add to DOM when ready
    setTimeout(() => {
      const collaborationUI = document.createElement('div');
      collaborationUI.innerHTML = collaborationHTML;
      document.body.appendChild(collaborationUI.firstElementChild!);

      this.setupCollaborationEventListeners();
    }, 1000);
  }

  public toggleCollaborationPanel(): void {
    console.log('🤝 Toggling collaboration panel...');
    const panel = document.getElementById('collaboration-panel');
    console.log('🤝 Panel found:', !!panel);
    if (panel) {
      const isCurrentlyHidden = panel.style.display === 'none' || panel.style.display === '';
      panel.style.display = isCurrentlyHidden ? 'block' : 'none';
      console.log('🤝 Panel now:', panel.style.display);
    } else {
      console.error('🤝 Collaboration panel not found in DOM');
    }
  }

  private setupCollaborationEventListeners(): void {
    console.log('🤝 Setting up collaboration event listeners...');

    // Close collaboration panel
    const closeBtn = document.getElementById('close-collaboration');
    console.log('🤝 Close button found:', !!closeBtn);
    closeBtn?.addEventListener('click', () => {
      console.log('🤝 Close button clicked');
      const panel = document.getElementById('collaboration-panel');
      if (panel) panel.style.display = 'none';
    });

    // Create room
    const createBtn = document.getElementById('create-room');
    console.log('🤝 Create room button found:', !!createBtn);
    createBtn?.addEventListener('click', async () => {
      console.log('🤝 Create room button clicked');
      const input = document.getElementById('room-name') as HTMLInputElement;
      if (input?.value) {
        const roomId = await this.createRoom(input.value);
        if (roomId) {
          await this.joinRoom(roomId);
          input.value = '';
        }
      }
    });

    // Send chat message
    const sendChat = () => {
      console.log('🤝 Sending chat message...');
      const input = document.getElementById('chat-input') as HTMLInputElement;
      if (input?.value) {
        this.sendChatMessage(input.value);
        input.value = '';
      }
    };

    const sendBtn = document.getElementById('send-chat');
    console.log('🤝 Send chat button found:', !!sendBtn);
    sendBtn?.addEventListener('click', sendChat);
    
    const chatInput = document.getElementById('chat-input');
    console.log('🤝 Chat input found:', !!chatInput);
    chatInput?.addEventListener('keypress', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') sendChat();
    });

    // Add comment
    const addComment = () => {
      console.log('🤝 Adding comment...');
      const input = document.getElementById('comment-input') as HTMLInputElement;
      if (input?.value) {
        this.addComment(input.value);
        input.value = '';
      }
    };

    const addBtn = document.getElementById('add-comment');
    console.log('🤝 Add comment button found:', !!addBtn);
    addBtn?.addEventListener('click', addComment);
    
    const commentInput = document.getElementById('comment-input');
    console.log('🤝 Comment input found:', !!commentInput);
    commentInput?.addEventListener('keypress', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') addComment();
    });
  }

  private updatePresenceUI(): void {
    const presenceEl = document.getElementById('user-presence');
    if (!presenceEl) return;

    if (this.userPresence.size === 0) {
      presenceEl.innerHTML = '<div class="text-xs text-muted-foreground">No users online</div>';
    } else {
      const users = Array.from(this.userPresence.values());
      presenceEl.innerHTML = users.map(user => `
        <div class="flex items-center gap-2 text-xs">
          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>${user.firstName || 'User'}</span>
        </div>
      `).join('');
    }
  }

  private updateRoomUI(): void {
    const roomEl = document.getElementById('current-room');
    if (roomEl && this.currentRoom) {
      roomEl.textContent = `Room: ${this.currentRoom.name}`;
      roomEl.classList.remove('text-muted-foreground');
      roomEl.classList.add('text-foreground');
    }
  }

  private addChatMessage(message: any): void {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;

    const messageEl = document.createElement('div');
    messageEl.className = 'text-xs';
    messageEl.innerHTML = `
      <span class="font-medium">${message.user?.firstName || 'User'}:</span>
      <span class="ml-1">${message.message}</span>
    `;

    messagesEl.appendChild(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  private displayComment(comment: any): void {
    // Add comment visualization to canvas
    console.log('💬 New comment:', comment);
  }

  private updateLiveCursor(cursor: any): void {
    // Update live cursor position on canvas
    console.log('👆 Cursor update:', cursor);
  }

  private setupCommentSystem(): void {
    console.log('🤝 Setting up comment system...');
    
    // Add double-click handler for canvas comments
    const setupCanvasHandler = () => {
      // Try multiple selectors to find the canvas
      const selectors = [
        '.kiteframe-canvas',
        '[data-testid="workflow-canvas"]', 
        '.react-flow__pane',
        '.react-flow__viewport',
        'canvas'
      ];
      
      let canvas = null;
      for (const selector of selectors) {
        canvas = document.querySelector(selector);
        if (canvas) {
          console.log(`🤝 Canvas found with selector: ${selector}`);
          break;
        }
      }
      
      if (canvas) {
        console.log('🤝 Adding double-click listener to canvas');
        canvas.addEventListener('dblclick', (e) => {
          console.log('🤝 Canvas double-clicked!');
          const rect = canvas.getBoundingClientRect();
          const x = (e as MouseEvent).clientX - rect.left;
          const y = (e as MouseEvent).clientY - rect.top;
          
          const comment = prompt('Add a comment:');
          if (comment) {
            console.log(`🤝 Adding comment at (${x}, ${y}):`, comment);
            this.addComment(comment, undefined, x, y);
          }
        });
      } else {
        console.error('🤝 Canvas element not found with any selector');
      }
    };
    
    // Try multiple times with longer delays
    setTimeout(setupCanvasHandler, 1000);
    setTimeout(setupCanvasHandler, 2000);
    setTimeout(setupCanvasHandler, 3000);
  }

  cleanup(): void {
    if (this.websocket) {
      this.websocket.close();
    }
    console.log('🤝 Collaboration Pro Plugin: Cleaned up');
  }
}

export const collaborationPlugin = new CollaborationPlugin();