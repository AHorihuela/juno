/**
 * ContextService - Main service for managing context
 * 
 * This class coordinates the various components of the context system
 * and provides a unified interface for the rest of the application.
 */

const BaseService = require('../BaseService');
const ClipboardManager = require('./ClipboardManager');
const ContextHistory = require('./ContextHistory');
const ContextRetrieval = require('./ContextRetrieval');

class ContextService extends BaseService {
  /**
   * Creates a new ContextService instance
   */
  constructor() {
    super('Context');
    
    // Initialize components
    this.clipboardManager = new ClipboardManager({
      checkInterval: 1000 // 1 second
    });
    
    this.contextHistory = new ContextHistory(5, 0.8);
    
    // Recording state
    this.recordingStartTime = null;
    this.isRecording = false;
    this.highlightedText = ''; // Add storage for highlighted text
    
    // Performance optimizations
    this.contextUpdateInterval = 1000; // 1 second
    this.lastContextUpdate = 0;
    this.pendingContextUpdate = null;
    
    // Memory manager reference
    this.memoryManager = null;
  }

  /**
   * Initialize the service
   * @private
   */
  async _initialize() {
    // Initialize memory manager
    this.memoryManager = this.getService('memoryManager');
    if (this.memoryManager) {
      await this.memoryManager.initialize(this.getServices());
      console.log('[ContextService] Memory manager initialized');
      
      // Migrate existing context history to memory manager
      this.migrateContextHistoryToMemoryManager();
    } else {
      console.warn('[ContextService] Memory manager not available, using legacy context storage');
    }
    
    // Initialize context retrieval
    this.contextRetrieval = new ContextRetrieval({
      clipboardManager: this.clipboardManager,
      contextHistory: this.contextHistory,
      memoryManager: this.memoryManager,
      contextCacheTTL: 2000 // 2 seconds
    });
    
    // Set up clipboard monitoring
    this.clipboardManager.startMonitoring();
    
    // Set up clipboard change handler
    this.clipboardManager.on('clipboardChange', this.handleClipboardChange.bind(this));
    this.clipboardManager.on('error', this.emitError.bind(this));
    
    // Get active application periodically
    this.appCheckInterval = setInterval(() => this.updateActiveApplication(), 5000);
  }

  /**
   * Shut down the service
   * @private
   */
  async _shutdown() {
    this.cleanup();
  }

  /**
   * Handle clipboard changes
   * @param {Object} clipboardData - Clipboard data
   * @private
   */
  handleClipboardChange(clipboardData) {
    try {
      const { content, timestamp, application } = clipboardData;
      
      // Add to context history if it's substantial (more than just a few characters)
      // and not too similar to existing items
      if (content.length > 10 && !this.contextHistory.isSimilarToExisting(content, 'clipboard')) {
        // Add to memory manager if available
        if (this.memoryManager) {
          console.log('[ContextService] Adding clipboard content to memory manager:', 
            content.substring(0, 50) + (content.length > 50 ? '...' : ''));
          
          // For SimpleMemoryManager, we need to use addMemoryItem with await
          this.memoryManager.addMemoryItem(content, {
            source: 'clipboard',
            application,
            timestamp
          }).catch(err => {
            console.error('[ContextService] Error adding clipboard to memory:', err);
          });
        }
        
        // Also add to legacy context history for backward compatibility
        this.contextHistory.addItem({
          type: 'clipboard',
          content,
          timestamp,
          application
        });
        
        // Invalidate context cache when new content is added
        this.contextRetrieval.invalidateContextCache();
      } else {
        console.log('[ContextService] Clipboard content not added to memory: too short or similar to existing content');
      }
    } catch (error) {
      this.emitError(error);
    }
  }

  /**
   * Update the active application information
   * @private
   */
  async updateActiveApplication() {
    try {
      const selectionService = this.getService('selection');
      if (selectionService) {
        // Use the cached version if available
        const activeApp = await selectionService.getCachedActiveAppName();
        
        // Update in all components
        this.clipboardManager.setActiveApplication(activeApp);
        this.contextRetrieval.setActiveApplication(activeApp);
      }
    } catch (error) {
      console.error('[ContextService] Error updating active application:', error);
    }
  }

  /**
   * Migrate existing context history to memory manager
   * @private
   */
  async migrateContextHistoryToMemoryManager() {
    if (!this.memoryManager || this.contextHistory.size() === 0) return;
    
    try {
      console.log('[ContextService] Migrating context history to memory manager');
      
      // Add each history item to memory manager
      const historyItems = this.contextHistory.getAll();
      for (const item of historyItems) {
        await this.memoryManager.addMemoryItem(item.content, {
          source: item.source || 'legacy',
          application: item.application,
          timestamp: item.timestamp
        });
      }
      
      console.log(`[ContextService] Migrated ${historyItems.length} items to memory manager`);
    } catch (error) {
      console.error('[ContextService] Error migrating context history:', error);
    }
  }

  /**
   * Start an internal clipboard operation
   */
  startInternalOperation() {
    this.clipboardManager.startInternalOperation();
  }

  /**
   * End an internal clipboard operation
   */
  endInternalOperation() {
    this.clipboardManager.endInternalOperation();
  }

  /**
   * Start a new recording session and capture highlighted text
   * @param {string} highlightedText - Text highlighted when recording starts
   */
  async startRecording(highlightedText) {
    try {
      this.recordingStartTime = Date.now();
      this.isRecording = true;
      this.highlightedText = highlightedText || '';
      
      // Update active application at recording start
      await this.updateActiveApplication();
      
      console.log('[ContextService] Recording started at:', this.recordingStartTime, 'with highlighted text:', this.highlightedText);
      
      // Add highlighted text to memory manager if available and text is not empty
      if (this.memoryManager && this.highlightedText && this.highlightedText.trim()) {
        console.log('[ContextService] Adding highlighted text to memory manager:', 
          this.highlightedText.substring(0, 50) + (this.highlightedText.length > 50 ? '...' : ''));
        
        try {
          await this.memoryManager.addMemoryItem(this.highlightedText, {
            source: 'highlighted_text',
            application: this.clipboardManager.activeApplication,
            timestamp: this.recordingStartTime
          });
        } catch (err) {
          console.error('[ContextService] Error adding highlighted text to memory:', err);
        }
      }
      
      // Also add to legacy context history if not too similar to existing items
      if (this.highlightedText && !this.contextHistory.isSimilarToExisting(this.highlightedText, 'highlight')) {
        this.contextHistory.addItem({
          type: 'highlight',
          content: this.highlightedText,
          timestamp: this.recordingStartTime,
          application: this.clipboardManager.activeApplication
        });
        
        // Invalidate context cache when new content is added
        this.contextRetrieval.invalidateContextCache();
      }
    } catch (error) {
      this.emitError(error);
    }
  }

  /**
   * End the current recording session
   */
  stopRecording() {
    try {
      this.recordingStartTime = null;
      this.isRecording = false;
      this.highlightedText = ''; // Clear highlighted text
      console.log('[ContextService] Recording stopped');
      
      // Invalidate context cache when recording stops
      this.contextRetrieval.invalidateContextCache();
    } catch (error) {
      this.emitError(error);
    }
  }

  /**
   * Get the current context for AI processing
   * @param {string} currentHighlightedText - Currently highlighted text (optional)
   * @param {string} command - Optional command for context-specific retrieval
   * @returns {Promise<Object>} Context object with primary and secondary contexts
   */
  async getContext(currentHighlightedText = '', command = null) {
    return this.contextRetrieval.getContext(
      currentHighlightedText,
      command,
      this.highlightedText,
      this.recordingStartTime
    );
  }
  
  /**
   * Get context asynchronously with debouncing
   * @param {string} currentHighlightedText - Currently highlighted text (optional)
   * @param {string} command - Optional command for context-specific retrieval
   * @returns {Promise<Object>} Context object with primary and secondary contexts
   */
  async getContextAsync(currentHighlightedText = '', command = null) {
    // Implement debouncing for context updates
    const now = Date.now();
    if (now - this.lastContextUpdate < 500) { // 500ms debounce
      // If we have a pending update, cancel it
      if (this.pendingContextUpdate) {
        clearTimeout(this.pendingContextUpdate.timeoutId);
      }
      
      // Set up a new pending update
      return new Promise((resolve) => {
        this.pendingContextUpdate = {
          timeoutId: setTimeout(async () => {
            const context = await this.getContext(currentHighlightedText, command);
            this.pendingContextUpdate = null;
            this.lastContextUpdate = Date.now();
            resolve(context);
          }, 500)
        };
      });
    }
    
    // No debouncing needed, update immediately
    this.lastContextUpdate = now;
    return await this.getContext(currentHighlightedText, command);
  }

  /**
   * Get memory statistics
   * @returns {Object} Memory statistics
   */
  getMemoryStats() {
    try {
      if (!this.memoryManager) {
        return {
          error: 'Memory manager not available',
          contextHistorySize: this.contextHistory.size()
        };
      }
      
      // Get stats from the simplified memory manager
      return this.memoryManager.getMemoryStats();
    } catch (error) {
      console.error('[ContextService] Error getting memory stats:', error);
      return {
        error: error.message,
        contextHistorySize: this.contextHistory.size()
      };
    }
  }

  /**
   * Delete a memory item
   * @param {string} id - ID of the memory item
   * @returns {Promise<boolean>} Success status
   */
  async deleteMemoryItem(id) {
    try {
      // Remove from legacy context history
      this.contextHistory.deleteItem(id);
      
      // Invalidate context cache
      this.contextRetrieval.invalidateContextCache();
      
      // If we have a memory manager, delete from there too
      if (this.memoryManager) {
        await this.memoryManager.deleteItem(id);
      }
      
      return true;
    } catch (error) {
      console.error('[ContextService] Error deleting memory item:', error);
      return false;
    }
  }

  /**
   * Clear memory
   * @param {string} [tier] - Memory tier to clear (ignored in simplified version)
   * @returns {Promise<boolean>} Success status
   */
  async clearMemory(tier) {
    try {
      // Clear legacy context history
      this.contextHistory.clear();
      
      // Invalidate context cache
      this.contextRetrieval.invalidateContextCache();
      
      // If we have a memory manager, clear it too
      if (this.memoryManager) {
        await this.memoryManager.clearAllMemory();
      }
      
      return true;
    } catch (error) {
      console.error('[ContextService] Error clearing memory:', error);
      return false;
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    try {
      // Clean up clipboard manager
      this.clipboardManager.cleanup();
      
      if (this.appCheckInterval) {
        clearInterval(this.appCheckInterval);
        this.appCheckInterval = null;
      }
      
      if (this.pendingContextUpdate) {
        clearTimeout(this.pendingContextUpdate.timeoutId);
        this.pendingContextUpdate = null;
      }
    } catch (error) {
      this.emitError(error);
    }
  }
  
  /**
   * Export context history for persistence
   * @returns {Object} Serializable context history
   */
  exportContextHistory() {
    // If memory manager is available, let it handle persistence
    if (this.memoryManager) {
      // Memory manager handles its own persistence
      return {
        usingMemoryManager: true,
        legacyHistory: this.contextHistory.getAll(),
        timestamp: Date.now()
      };
    }
    
    // Legacy export
    return this.contextHistory.export();
  }
  
  /**
   * Import context history from persistence
   * @param {Object} data - Previously exported context history
   * @returns {boolean} Success status
   */
  importContextHistory(data) {
    try {
      if (!data) {
        return false;
      }
      
      // Handle memory manager format
      if (data.usingMemoryManager) {
        // Memory manager handles its own persistence
        if (data.legacyHistory && Array.isArray(data.legacyHistory)) {
          // Create a compatible format for the context history
          const historyData = {
            history: data.legacyHistory,
            timestamp: data.timestamp
          };
          
          const result = this.contextHistory.import(historyData);
          console.log('[ContextService] Imported legacy context history, size:', this.contextHistory.size());
          return result;
        }
        return true;
      }
      
      // Legacy import
      const result = this.contextHistory.import(data);
      
      // Invalidate context cache
      if (result) {
        this.contextRetrieval.invalidateContextCache();
      }
      
      return result;
    } catch (error) {
      console.error('[ContextService] Error importing context history:', error);
      return false;
    }
  }
}

module.exports = ContextService; 