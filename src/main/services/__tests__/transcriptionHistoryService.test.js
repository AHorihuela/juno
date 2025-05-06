const fs = require('fs');
const path = require('path');
const { app } = require('electron');

jest.mock('fs');
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/user/data'),
    getName: jest.fn(() => 'Juno'),
    getVersion: jest.fn(() => '1.0.0')
  }
}));

const transcriptionHistoryServiceFactory = require('../transcriptionHistoryService');

describe('TranscriptionHistoryService', () => {
  const mockHistoryFile = '/mock/user/data/transcription-history.json';
  let transcriptionHistoryService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({ transcriptions: [] }));
    
    // Create a new instance for each test
    transcriptionHistoryService = transcriptionHistoryServiceFactory();
    
    // Mock the initialize method to avoid needing to wait for initialization
    transcriptionHistoryService.ensureHistoryFile = jest.fn();
    transcriptionHistoryService.historyFile = mockHistoryFile;
    
    // Mock emitError to prevent unhandled errors
    transcriptionHistoryService.emitError = jest.fn(error => {
      console.log(`Mocked error: ${error.message}`);
      return error;
    });
  });

  describe('getHistory', () => {
    it('returns empty array when no history exists', () => {
      const history = transcriptionHistoryService.getHistory();
      expect(history).toEqual([]);
    });

    it('returns transcription history when it exists', () => {
      const mockHistory = [
        { id: 1, text: 'Test 1', timestamp: '2024-02-20T00:00:00.000Z' },
        { id: 2, text: 'Test 2', timestamp: '2024-02-20T00:01:00.000Z' }
      ];
      fs.readFileSync.mockReturnValue(JSON.stringify({ transcriptions: mockHistory }));

      const history = transcriptionHistoryService.getHistory();
      expect(history).toEqual(mockHistory);
    });

    it('returns empty array on file read error', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const history = transcriptionHistoryService.getHistory();
      expect(history).toEqual([]);
      expect(transcriptionHistoryService.emitError).toHaveBeenCalled();
    });
  });

  describe('addTranscription', () => {
    it('adds new transcription at the beginning of history', () => {
      const mockHistory = [
        { id: 1, text: 'Old test', timestamp: '2024-02-20T00:00:00.000Z' }
      ];
      fs.readFileSync.mockReturnValue(JSON.stringify({ transcriptions: mockHistory }));

      const newTranscription = 'New test';
      const result = transcriptionHistoryService.addTranscription(newTranscription);

      expect(result.text).toBe(newTranscription);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockHistoryFile,
        expect.stringContaining(newTranscription)
      );
    });

    it('limits history to maximum entries', () => {
      const mockHistory = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        text: `Test ${i}`,
        timestamp: new Date().toISOString()
      }));
      fs.readFileSync.mockReturnValue(JSON.stringify({ transcriptions: mockHistory }));

      transcriptionHistoryService.addTranscription('New test');

      const writeCall = fs.writeFileSync.mock.calls[0][1];
      const written = JSON.parse(writeCall);
      expect(written.transcriptions.length).toBe(10);
      expect(written.transcriptions[0].text).toBe('New test');
    });
  });

  describe('deleteTranscription', () => {
    it('removes transcription with specified id', () => {
      const mockHistory = [
        { id: 1, text: 'Test 1', timestamp: '2024-02-20T00:00:00.000Z' },
        { id: 2, text: 'Test 2', timestamp: '2024-02-20T00:01:00.000Z' }
      ];
      fs.readFileSync.mockReturnValue(JSON.stringify({ transcriptions: mockHistory }));

      transcriptionHistoryService.deleteTranscription(1);

      const writeCall = fs.writeFileSync.mock.calls[0][1];
      const written = JSON.parse(writeCall);
      expect(written.transcriptions.length).toBe(1);
      expect(written.transcriptions[0].id).toBe(2);
    });
  });

  describe('clearHistory', () => {
    it('clears all transcription history', () => {
      transcriptionHistoryService.clearHistory();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockHistoryFile,
        JSON.stringify({ transcriptions: [] })
      );
    });
  });
}); 