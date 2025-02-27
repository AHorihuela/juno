const { globalShortcut } = require('electron');
const LogManager = require('./LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('ShortcutManager');

// Constants
const FN_DOUBLE_TAP_DELAY = 150; // ms (reduced from 200ms for faster response)

// State variables
let lastFnKeyPress = 0;
let fnKeyTimeout = null;

/**
 * Normalizes a keyboard shortcut to ensure it uses ASCII characters
 * @param {string} shortcut - The keyboard shortcut to normalize
 * @returns {string} - The normalized shortcut
 */
function normalizeShortcut(shortcut) {
  if (!shortcut) {
    logger.warn('Attempted to normalize undefined or empty shortcut');
    return '';
  }
  
  // Replace macOS symbols with their ASCII equivalents
  return shortcut
    .replace('⌘', 'Command')
    .replace('⇧', 'Shift')
    .replace('⌥', 'Alt')
    .replace('⌃', 'Control');
}

/**
 * Registers all global shortcuts for the application
 * @param {Object} serviceRegistry - The service registry instance
 * @returns {Promise<boolean>} - True if shortcuts were registered successfully
 */
async function registerShortcuts(serviceRegistry) {
  logger.info('Registering application shortcuts...');
  
  if (!serviceRegistry) {
    logger.error('Service registry not provided to registerShortcuts');
    return false;
  }
  
  try {
    // Get configured shortcut
    const configService = serviceRegistry.get('config');
    if (!configService) {
      logger.error('Config service not available for shortcut registration');
      return false;
    }
    
    logger.debug('Retrieved config service, getting keyboard shortcut...');
    
    const rawShortcut = await configService.getKeyboardShortcut();
    logger.debug('Retrieved keyboard shortcut from config:', { metadata: { rawShortcut } });
    
    if (!rawShortcut) {
      logger.warn('No keyboard shortcut configured, skipping registration');
      return false;
    }
    
    const shortcut = normalizeShortcut(rawShortcut);
    
    logger.info('Registering keyboard shortcut:', { 
      metadata: { 
        rawShortcut, 
        normalizedShortcut: shortcut 
      } 
    });
    
    // Unregister any existing shortcuts to avoid conflicts
    try {
      globalShortcut.unregister(shortcut);
    } catch (error) {
      logger.warn('Error unregistering existing shortcut:', { metadata: { error } });
    }
    
    // Register configured shortcut for toggle
    const success = globalShortcut.register(shortcut, () => {
      logger.debug('Shortcut triggered');
      const now = Date.now();
      
      try {
        const recorder = serviceRegistry.get('recorder');
        if (!recorder) {
          logger.error('Recorder service not available for shortcut action');
          return;
        }
        
        if (now - lastFnKeyPress <= FN_DOUBLE_TAP_DELAY) {
          // Double tap detected
          logger.info('Double tap detected, starting recording');
          clearTimeout(fnKeyTimeout);
          
          if (!recorder.isRecording()) {
            logger.debug('Initiating recording via shortcut');
            recorder.start().catch(error => {
              logger.error('Error starting recording via shortcut:', { metadata: { error } });
            });
          }
        } else {
          // Single tap - wait to see if it's a double tap
          logger.debug('Single tap detected, waiting for potential double tap');
          
          if (fnKeyTimeout) {
            clearTimeout(fnKeyTimeout);
          }
          
          fnKeyTimeout = setTimeout(() => {
            try {
              if (recorder.isRecording()) {
                logger.info('Single tap timeout reached, stopping recording');
                recorder.stop().catch(error => {
                  logger.error('Error stopping recording via shortcut:', { metadata: { error } });
                });
              }
            } catch (error) {
              logger.error('Error in shortcut timeout handler:', { metadata: { error } });
            }
          }, FN_DOUBLE_TAP_DELAY);
        }
        
        lastFnKeyPress = now;
      } catch (error) {
        logger.error('Error handling shortcut:', { metadata: { error } });
      }
    });
    
    logger.info('Shortcut registration result:', { metadata: { success } });
    return success;
  } catch (error) {
    logger.error('Error registering shortcuts:', { metadata: { error } });
    return false;
  }
}

/**
 * Unregisters all global shortcuts
 */
function unregisterAllShortcuts() {
  try {
    logger.info('Unregistering all shortcuts');
    globalShortcut.unregisterAll();
    logger.info('All shortcuts unregistered successfully');
  } catch (error) {
    logger.error('Error unregistering shortcuts:', { metadata: { error } });
  }
}

module.exports = {
  registerShortcuts,
  unregisterAllShortcuts,
  normalizeShortcut
}; 