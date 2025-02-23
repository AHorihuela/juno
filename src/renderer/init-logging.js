console.log('[HTML] Document loaded');

window.addEventListener('DOMContentLoaded', () => {
  console.log('[HTML] DOM Content loaded');
});

// Log renderer.js loading
console.log('[HTML] Before loading renderer.js');
window.addEventListener('load', () => {
  console.log('[HTML] After loading renderer.js');
}); 