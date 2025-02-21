const { ipcMain } = require('electron');
const dictionaryService = require('./dictionaryService');

function setupDictionaryIpcHandlers() {
  ipcMain.handle('get-dictionary-entries', async () => {
    try {
      return dictionaryService.getAllEntries();
    } catch (error) {
      console.error('Error getting dictionary entries:', error);
      throw new Error('Failed to get dictionary entries');
    }
  });

  ipcMain.handle('add-dictionary-entry', async (event, { incorrect, correct }) => {
    try {
      return dictionaryService.addEntry(incorrect, correct);
    } catch (error) {
      console.error('Error adding dictionary entry:', error);
      throw error;
    }
  });

  ipcMain.handle('remove-dictionary-entry', async (event, incorrect) => {
    try {
      return dictionaryService.removeEntry(incorrect);
    } catch (error) {
      console.error('Error removing dictionary entry:', error);
      throw new Error('Failed to remove dictionary entry');
    }
  });
}

module.exports = setupDictionaryIpcHandlers; 