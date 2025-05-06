const { normalizeShortcut, registerShortcuts, unregisterAllShortcuts } = require('../../main/utils/shortcutManager');
const { globalShortcut } = require('electron');

// Mock electron
jest.mock('electron', () => ({
  globalShortcut: {
    register: jest.fn().mockReturnValue(true),
    unregisterAll: jest.fn(),
    unregister: jest.fn()
  }
}));

// Create mock services
const mockConfigService = {
  getKeyboardShortcut: jest.fn().mockResolvedValue('Command+Shift+Space')
};

const mockRecorderService = {
  isRecording: jest.fn(),
  start: jest.fn(),
  stop: jest.fn()
};

// Create mock service registry
const mockServiceRegistry = {
  get: jest.fn(service => {
    if (service === 'config') return mockConfigService;
    if (service === 'recorder') return mockRecorderService;
    return null;
  })
};

describe('ShortcutManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeShortcut', () => {
    it('should convert macOS symbols to ASCII equivalents', () => {
      expect(normalizeShortcut('⌘⇧ Space')).toBe('CommandShift Space');
      expect(normalizeShortcut('⌘Q')).toBe('CommandQ');
      expect(normalizeShortcut('⌥⌃T')).toBe('AltControlT');
    });

    it('should leave ASCII shortcuts unchanged', () => {
      expect(normalizeShortcut('Command+Shift+Space')).toBe('Command+Shift+Space');
      expect(normalizeShortcut('Control+Alt+Delete')).toBe('Control+Alt+Delete');
      expect(normalizeShortcut('F12')).toBe('F12');
      expect(normalizeShortcut('Escape')).toBe('Escape');
    });

    it('should handle mixed format shortcuts', () => {
      expect(normalizeShortcut('⌘Shift+Space')).toBe('CommandShift+Space');
      expect(normalizeShortcut('Control+⌥+T')).toBe('Control+Alt+T');
    });
  });

  describe('registerShortcuts', () => {
    it('should register the normalized keyboard shortcut', async () => {
      // Mock the config service to return a shortcut with macOS symbols
      mockConfigService.getKeyboardShortcut.mockResolvedValue('⌘⇧ Space');

      await registerShortcuts(mockServiceRegistry);

      // Verify that the shortcut was normalized before registration
      expect(globalShortcut.register).toHaveBeenCalledWith(
        'CommandShift Space',
        expect.any(Function)
      );
    });

    it('should register ASCII shortcuts without modification', async () => {
      // Mock the config service to return an ASCII shortcut
      mockConfigService.getKeyboardShortcut.mockResolvedValue('Command+Shift+Space');

      await registerShortcuts(mockServiceRegistry);

      // Verify that the shortcut was registered as-is
      expect(globalShortcut.register).toHaveBeenCalledWith(
        'Command+Shift+Space',
        expect.any(Function)
      );
    });
  });

  describe('unregisterAllShortcuts', () => {
    it('should unregister all shortcuts', () => {
      unregisterAllShortcuts();
      expect(globalShortcut.unregisterAll).toHaveBeenCalled();
    });
  });
}); 