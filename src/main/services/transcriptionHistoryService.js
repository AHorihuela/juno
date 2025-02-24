const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const BaseService = require('./BaseService');

class TranscriptionHistoryService extends BaseService {
  constructor() {
    super('TranscriptionHistory');
    this.historyFile = path.join(app.getPath('userData'), 'transcription-history.json');
    this.maxEntries = 10;
  }

  async _initialize() {
    this.ensureHistoryFile();
  }

  async _shutdown() {
    // Nothing to clean up
  }

  ensureHistoryFile() {
    try {
      const dir = path.dirname(this.historyFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(this.historyFile)) {
        fs.writeFileSync(this.historyFile, JSON.stringify({ transcriptions: [] }));
      }
    } catch (error) {
      this.emitError(error);
    }
  }

  getHistory() {
    try {
      const data = fs.readFileSync(this.historyFile, 'utf8');
      return JSON.parse(data).transcriptions;
    } catch (error) {
      this.emitError(error);
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
      this.emitError(error);
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
      this.emitError(error);
      throw error;
    }
  }

  clearHistory() {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify({ transcriptions: [] }));
    } catch (error) {
      this.emitError(error);
      throw error;
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new TranscriptionHistoryService(); 