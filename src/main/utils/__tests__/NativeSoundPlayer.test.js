const { playSound } = require('../NativeSoundPlayer');
const childProcess = require('child_process');
const LogManager = require('../LogManager'); // Ensure this path is correct

// Mock child_process
jest.mock('child_process');

// Mock LogManager to prevent actual logging during tests and allow spying
jest.mock('../LogManager', () => {
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return {
    getLogger: jest.fn(() => mockLogger),
  };
});

describe('NativeSoundPlayer', () => {
  let originalPlatform;
  const mockExec = childProcess.exec;
  const mockLogger = LogManager.getLogger(); // Get the mocked logger instance

  beforeEach(() => {
    // Reset mocks before each test
    mockExec.mockReset();
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();

    // Store original platform and define it for process.platform
    originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: 'darwin', // Default to macOS for most tests
    });
  });

  afterEach(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: originalPlatform,
    });
  });

  const soundPath = '/test/sound.wav';

  // Helper to simulate exec success
  const mockExecSuccess = () => {
    mockExec.mockImplementation((command, callback) => {
      if (typeof callback === 'function') {
        callback(null, 'stdout', 'stderr'); // Simulate success
      }
      const mockChildProcess = {
        on: (event, cb) => {
          if (event === 'exit') cb(0); // Simulate successful exit for sync
          if (event === 'error') {} // No error
        },
      };
      return mockChildProcess;
    });
  };

  // Helper to simulate exec failure
  const mockExecFailure = (errorMessage = 'Command failed') => {
    mockExec.mockImplementation((command, callback) => {
      const error = new Error(errorMessage);
      if (typeof callback === 'function') {
        callback(error, null, null); // Simulate error
      }
      const mockChildProcess = {
        listeners: {},
        on(event, cb) {
          this.listeners[event] = cb;
          return this;
        },
        // Helper to manually trigger events for more precise testing
        emit(event, ...args) {
          if (this.listeners[event]) {
            this.listeners[event](...args);
          }
        }
      };
      // For the general exec failure, ensure the 'error' event on child is also fired for robustness
      // or the main callback is called with an error.
      // Specific tests below will override this mockImplementation for more granular scenarios.
      setTimeout(() => mockChildProcess.emit('error', error), 0);
      return mockChildProcess;
    });
  };

  describe('playSound', () => {
    it('should reject if no soundPath is provided', async () => {
      await expect(playSound('')).rejects.toThrow('No soundPath provided.');
      expect(mockLogger.error).toHaveBeenCalledWith('No soundPath provided.');
    });

    describe('macOS', () => {
      beforeEach(() => Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true }));

      it('should execute afplay command for macOS (async)', async () => {
        mockExecSuccess();
        await playSound(soundPath, false);
        expect(mockExec).toHaveBeenCalledWith(`afplay "${soundPath}"`, expect.any(Function));
      });

      it('should execute afplay command for macOS (sync)', async () => {
        mockExecSuccess();
        await playSound(soundPath, true);
        expect(mockExec).toHaveBeenCalledWith(`afplay "${soundPath}"`, expect.any(Function));
      });
    });

    describe('Windows', () => {
      beforeEach(() => Object.defineProperty(process, 'platform', { value: 'win32', configurable: true }));

      it('should execute powershell Play command for Windows (async)', async () => {
        mockExecSuccess();
        await playSound(soundPath, false);
        const expectedCmd = `powershell -ExecutionPolicy Bypass -NoProfile -Command "(New-Object Media.SoundPlayer '${soundPath}').Play()"`;
        expect(mockExec).toHaveBeenCalledWith(expectedCmd, expect.any(Function));
      });

      it('should execute powershell PlaySync command for Windows (sync)', async () => {
        mockExecSuccess();
        await playSound(soundPath, true);
        const expectedCmd = `powershell -ExecutionPolicy Bypass -NoProfile -Command "(New-Object Media.SoundPlayer '${soundPath}').PlaySync()"`;
        expect(mockExec).toHaveBeenCalledWith(expectedCmd, expect.any(Function));
      });
    });

    describe('Linux', () => {
      beforeEach(() => Object.defineProperty(process, 'platform', { value: 'linux', configurable: true }));

      it('should execute paplay command for Linux (async)', async () => {
        mockExecSuccess();
        await playSound(soundPath, false);
        expect(mockExec).toHaveBeenCalledWith(`paplay "${soundPath}"`, expect.any(Function));
      });

      it('should execute paplay command for Linux (sync)', async () => {
        // Note: paplay is typically async, but the promise waits for command completion.
        mockExecSuccess();
        await playSound(soundPath, true);
        expect(mockExec).toHaveBeenCalledWith(`paplay "${soundPath}"`, expect.any(Function));
      });
    });

    it('should reject on unsupported platform', async () => {
      Object.defineProperty(process, 'platform', { value: 'sunos', configurable: true }); // Unsupported
      await expect(playSound(soundPath)).rejects.toThrow('Unsupported platform: sunos');
      expect(mockLogger.warn).toHaveBeenCalledWith('Unsupported platform for native sound playback: sunos');
    });

    it('should resolve on successful command execution (async)', async () => {
      mockExecSuccess();
      await expect(playSound(soundPath, false)).resolves.toBeUndefined();
    });

    it('should resolve on successful command execution (sync)', async () => {
      mockExecSuccess();
      await expect(playSound(soundPath, true)).resolves.toBeUndefined();
    });

    it('should reject if exec calls back with an error (async)', async () => {
      mockExecFailure('Playback failed');
      await expect(playSound(soundPath, false)).rejects.toThrow('Playback failed');
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error playing sound'), expect.any(Error));
    });
    
    it('should reject if exec calls back with an error (sync)', async () => {
      mockExecFailure('Playback failed');
      await expect(playSound(soundPath, true)).rejects.toThrow('Playback failed');
       expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error playing sound'), expect.any(Error));
    });

    it('should reject if sync process emits error', async () => {
        mockExec.mockImplementation((command, callback) => {
            const error = new Error('Process error');
            const mockChildProcess = {
                listeners: {},
                on(event, cb) {
                  this.listeners[event] = cb;
                  return this;
                },
                emit(event, ...args) {
                  if (this.listeners[event]) {
                    this.listeners[event](...args);
                  }
                }
            };
            // Simulate only the 'error' event being emitted by the child process
            setTimeout(() => mockChildProcess.emit('error', error), 0);
            // The main callback of exec might or might not be called in this scenario,
            // or it might be called without an error. The crucial part is the child.on('error').
            // For this test, we assume the 'error' event on child is the one causing rejection.
            return mockChildProcess;
        });
        await expect(playSound(soundPath, true)).rejects.toThrow('Process error');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error with sound process'), expect.any(Error));
    });

    it('should reject if sync process exits with non-zero code', async () => {
        mockExec.mockImplementation((command, callback) => {
            const mockChildProcess = {
                listeners: {},
                on(event, cb) {
                  this.listeners[event] = cb;
                  return this;
                },
                emit(event, ...args) {
                  if (this.listeners[event]) {
                    this.listeners[event](...args);
                  }
                }
            };
            // Simulate only the 'exit' event with a non-zero code
            setTimeout(() => mockChildProcess.emit('exit', 1), 0);
            // The main exec callback might be called without an error here.
            if (typeof callback === 'function') {
                // callback(null, 'stdout', 'stderr'); // Simulate exec itself not erroring initially
            }
            return mockChildProcess;
        });
        await expect(playSound(soundPath, true)).rejects.toThrow('Native sound command exited with code 1');
        // Check that the logger was called with an Error object as the second argument
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Native sound command for \'/test/sound.wav\' exited with code: 1'),
            expect.any(Error) // This ensures an Error object was logged
        );
    });

  });
});
