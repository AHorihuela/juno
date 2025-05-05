/**
 * RecordingManager - Handles microphone access and audio recording
 * 
 * This module:
 * - Checks for microphone permissions
 * - Manages audio recording sessions
 * - Handles start/stop of recording
 */

const { EventEmitter } = require('events');
const logger = require('../../../logger');

class RecordingManager extends EventEmitter {
  constructor() {
    super();
    this.initialized = false;
    this.isRecording = false;
    this.currentSessionId = null;
    this.services = null;
    this.audioService = null;
    this.recorderService = null;
  }

  /**
   * Initialize the recording manager
   * @param {ServiceRegistry} services Service registry
   * @returns {Promise<void>}
   */
  async initialize(services) {
    if (this.initialized) {
      return;
    }

    logger.debug('Initializing recording manager');
    this.services = services;

    try {
      // Try to get audio and recorder services
      this.audioService = services.get('audio');
      this.recorderService = services.get('recorder');
      
      this.initialized = true;
      logger.debug('Recording manager initialized successfully');
    } catch (error) {
      logger.error('Error initializing recording manager:', error);
      throw error;
    }
  }

  /**
   * Shutdown the recording manager
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.debug('Shutting down recording manager');

    try {
      // Stop any ongoing recording
      if (this.isRecording) {
        await this.stopRecording();
      }

      this.initialized = false;
      logger.debug('Recording manager shutdown complete');
    } catch (error) {
      logger.error('Error shutting down recording manager:', error);
    }
  }

  /**
   * Check if the application has microphone access
   * @returns {Promise<boolean>} Whether microphone access is granted
   */
  async checkMicrophoneAccess() {
    try {
      logger.debug('Checking microphone access');
      
      // If we have a recorder service, use it to check permissions
      if (this.recorderService && typeof this.recorderService.checkMicrophonePermission === 'function') {
        return await this.recorderService.checkMicrophonePermission();
      }
      
      // Fall back to platform-specific implementation
      return await this._platformCheckMicrophoneAccess();
    } catch (error) {
      logger.error('Error checking microphone access:', error);
      return false;
    }
  }

  /**
   * Start recording audio
   * @param {Object} options Recording options
   * @returns {Promise<boolean>} Success status
   */
  async startRecording(options = {}) {
    if (!this.initialized) {
      throw new Error('Recording manager not initialized');
    }

    if (this.isRecording) {
      logger.debug('Recording already in progress');
      return true;
    }

    try {
      logger.debug('Starting audio recording');
      
      // Set session ID
      this.currentSessionId = options.sessionId || `recording-${Date.now()}`;
      
      // Start recording with the recorder service if available
      if (this.recorderService && typeof this.recorderService.startRecording === 'function') {
        await this.recorderService.startRecording();
      }
      
      this.isRecording = true;
      
      // Emit recording started event
      this.emit('recording-started', { 
        sessionId: this.currentSessionId,
        timestamp: Date.now() 
      });
      
      logger.debug('Audio recording started successfully');
      return true;
    } catch (error) {
      logger.error('Error starting audio recording:', error);
      return false;
    }
  }

  /**
   * Stop recording audio
   * @returns {Promise<boolean>} Success status
   */
  async stopRecording() {
    if (!this.isRecording) {
      return true;
    }

    try {
      logger.debug('Stopping audio recording');
      
      // Stop recording with the recorder service if available
      if (this.recorderService && typeof this.recorderService.stopRecording === 'function') {
        await this.recorderService.stopRecording();
      }
      
      this.isRecording = false;
      
      // Emit recording stopped event
      this.emit('recording-stopped', { 
        sessionId: this.currentSessionId,
        timestamp: Date.now() 
      });
      
      logger.debug('Audio recording stopped successfully');
      return true;
    } catch (error) {
      logger.error('Error stopping audio recording:', error);
      this.isRecording = false; // Force state to stopped even on error
      return false;
    }
  }

  /**
   * Platform-specific implementation of microphone access check
   * @returns {Promise<boolean>} Whether microphone access is granted
   * @private
   */
  async _platformCheckMicrophoneAccess() {
    // This needs to be customized based on the platform (Electron, Web, etc.)
    // For now, we'll return a default value
    
    // On Electron, we could use systemPreferences.getMediaAccessStatus('microphone')
    // On the web, we could use navigator.mediaDevices.getUserMedia
    
    logger.debug('Using platform-specific microphone access check');
    
    try {
      // Example implementation for Electron
      const { systemPreferences } = require('electron');
      
      if (systemPreferences && typeof systemPreferences.getMediaAccessStatus === 'function') {
        const status = systemPreferences.getMediaAccessStatus('microphone');
        logger.debug(`Microphone access status: ${status}`);
        return status === 'granted';
      }
      
      // Example implementation for Web
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          // Clean up the stream
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
          
          return true;
        } catch (err) {
          logger.warn('Error accessing microphone:', err);
          return false;
        }
      }
      
      // If we can't check, assume we have access for now
      logger.warn('Unable to check microphone access, assuming granted');
      return true;
    } catch (error) {
      logger.error('Error in platform-specific microphone check:', error);
      return false;
    }
  }
}

module.exports = RecordingManager; 