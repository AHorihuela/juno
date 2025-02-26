const { ipcMain, globalShortcut } = require('electron');
const LogManager = require('../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('SettingsHandlers');

/**
 * Sets up all settings-related IPC handlers
 * @param {Object} serviceRegistry - The service registry instance
 */
function setupSettingsHandlers(serviceRegistry) {
  logger.info('Setting up settings handlers...');
  
  // Update settings handlers to use handle/invoke
  ipcMain.handle('save-settings', async (_, settings) => {
    try {
      const configService = serviceRegistry.get('config');
      
      // Handle each setting individually to properly handle null/undefined
      if (settings.openaiApiKey !== undefined) {
        await configService.setOpenAIApiKey(settings.openaiApiKey || '');
      }
      if (settings.aiTriggerWord !== undefined) {
        await configService.setAITriggerWord(settings.aiTriggerWord || 'juno');
      }
      if (settings.aiModel !== undefined) {
        await configService.setAIModel(settings.aiModel || 'gpt-4');
      }
      if (settings.aiTemperature !== undefined) {
        await configService.setAITemperature(settings.aiTemperature || 0.7);
      }
      if (settings.startupBehavior !== undefined) {
        await configService.setStartupBehavior(settings.startupBehavior || 'minimized');
      }
      if (settings.defaultMicrophone !== undefined) {
        await configService.setDefaultMicrophone(settings.defaultMicrophone || '');
      }
      if (settings.actionVerbs !== undefined) {
        await configService.setActionVerbs(settings.actionVerbs);
      }
      if (settings.actionVerbsEnabled !== undefined) {
        await configService.setActionVerbsEnabled(settings.actionVerbsEnabled);
      }
      if (settings.aiRules !== undefined) {
        await configService.setAIRules(settings.aiRules);
      }
      if (settings.keyboardShortcut !== undefined) {
        await configService.setKeyboardShortcut(settings.keyboardShortcut);
        
        // Re-register shortcuts when the keyboard shortcut changes
        const registerShortcuts = require('../utils/shortcutManager').registerShortcuts;
        globalShortcut.unregisterAll();
        await registerShortcuts(serviceRegistry);
      }
      return { success: true };
    } catch (error) {
      logger.error('Error saving settings:', { metadata: { error } });
      throw new Error(`Failed to save settings: ${error.message}`);
    }
  });
  
  logger.info('Settings handlers setup complete');
}

module.exports = setupSettingsHandlers; 