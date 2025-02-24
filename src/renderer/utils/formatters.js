/**
 * Format keyboard shortcut for display
 * @param {string} shortcut - Raw keyboard shortcut string
 * @returns {string} HTML string with formatted shortcut
 */
export const formatShortcut = (shortcut) => {
  if (!shortcut) return '';
  return shortcut
    .replace('CommandOrControl', '⌘')
    .replace('Command', '⌘')
    .replace('Control', 'Ctrl')
    .replace('Shift', '⇧')
    .replace('Alt', '⌥')
    .replace('Option', '⌥')
    .split('+')
    .map(key => `<kbd class="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-md">${key}</kbd>`)
    .join('<span class="text-gray-400 mx-1">+</span>');
}; 