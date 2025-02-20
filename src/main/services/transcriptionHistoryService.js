const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class TranscriptionHistoryService {
  constructor() {
    this.historyFile = path.join(app.getPath('userData'), 'transcription-history.json');
    this.maxEntries = 10;
    this.ensureHistoryFile();
  }

  ensureHistoryFile() {
    if (!fs.existsSync(this.historyFile)) {
      fs.writeFileSync(this.historyFile, JSON.stringify({ transcriptions: [] }));
    }
  }

  getHistory() {
    try {
      const data = fs.readFileSync(this.historyFile, 'utf8');
      return JSON.parse(data).transcriptions;
    } catch (error) {
      console.error('Error reading transcription history:', error);
      return [];
    }
  }

  addTranscription(text) {
    try {
      const history = this.getHistory();
      const newEntry = {
        id: Date.now(),
        text,
        timestamp: new Date().toISOString()
      };

      // Add new entry at the beginning and keep only the last maxEntries
      const updatedHistory = [newEntry, ...history].slice(0, this.maxEntries);

      fs.writeFileSync(
        this.historyFile,
        JSON.stringify({ transcriptions: updatedHistory }, null, 2)
      );

      return newEntry;
    } catch (error) {
      console.error('Error adding transcription to history:', error);
      throw error;
    }
  }

  deleteTranscription(id) {
    try {
      const history = this.getHistory();
      const updatedHistory = history.filter(entry => entry.id !== id);

      fs.writeFileSync(
        this.historyFile,
        JSON.stringify({ transcriptions: updatedHistory }, null, 2)
      );
    } catch (error) {
      console.error('Error deleting transcription from history:', error);
      throw error;
    }
  }

  clearHistory() {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify({ transcriptions: [] }));
    } catch (error) {
      console.error('Error clearing transcription history:', error);
      throw error;
    }
  }
}

module.exports = new TranscriptionHistoryService(); 