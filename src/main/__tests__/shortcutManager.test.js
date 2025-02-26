const { normalizeShortcut, registerShortcuts, unregisterAllShortcuts } = require('../../main/utils/shortcutManager');
const { globalShortcut } = require('electron');
const serviceRegistry = require('../../main/services/ServiceRegistry');

// Mock electron
jest.mock('electron', () => ({
  globalShortcut: {
    register: jest.fn().mockReturnValue(true),
    unregisterAll: jest.fn()
  }
}));

// Mock service registry
jest.mock('../../main/services/ServiceRegistry', () => ({
  get: jest.fn().mockImplementation((service) => {
    if (service === 'config') {
      return {
        getKeyboardShortcut: jest.fn().mockResolvedValue('Command+Shift+Space')
      };
    }
    if (service === 'recorder') {
      return {
        isRecording: jest.fn(),
        start: jest.fn(),
        stop: jest.fn()
      };
    }
    return {};
  })
}));

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
      serviceRegistry.get.mockImplementation((service) => {
        if (service === 'config') {
          return {
            getKeyboardShortcut: jest.fn().mockResolvedValue('⌘⇧ Space')
          };
        }
        return {};
      });

      await registerShortcuts();

      // Verify that the shortcut was normalized before registration
      expect(globalShortcut.register).toHaveBeenCalledWith(
        'CommandShift Space',
        expect.any(Function)
      );
    });

    it('should register ASCII shortcuts without modification', async () => {
      // Mock the config service to return an ASCII shortcut
      serviceRegistry.get.mockImplementation((service) => {
        if (service === 'config') {
          return {
            getKeyboardShortcut: jest.fn().mockResolvedValue('Command+Shift+Space')
          };
        }
        return {};
      });

      await registerShortcuts();

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