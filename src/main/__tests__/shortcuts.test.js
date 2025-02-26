const { normalizeShortcut } = require('../../main/utils/shortcutManager');

describe('Keyboard Shortcuts', () => {
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
}); 