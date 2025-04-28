import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';

console.log('[React] Starting application initialization...');

// Log any potential errors during module loading
try {
  console.log('[React] Importing CSS...');
  require('./styles/main.css');
  console.log('[React] CSS imported successfully');
} catch (error) {
  console.error('[React] Error importing CSS:', error);
}

console.log('[React] Looking for root element...');
const container = document.getElementById('root');
console.log('[React] Root element found:', container);

if (!container) {
  console.error('[React] Failed to find root element!');
} else {
  try {
    console.log('[React] Creating React root...');
    const root = createRoot(container);
    console.log('[React] Created React root successfully');
    
    console.log('[React] Starting render...');
    root.render(
      <React.StrictMode>
        <HashRouter>
          <App />
        </HashRouter>
      </React.StrictMode>
    );
    console.log('[React] Render completed');
  } catch (error) {
    console.error('[React] Error during React initialization:', error);
  }
}

console.log('[Renderer] index.js loaded');

window.addEventListener('DOMContentLoaded', () => {
  console.log('[Renderer] DOMContentLoaded');
});

window.addEventListener('error', (event) => {
  console.error('[Renderer] Global error:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Renderer] Unhandled promise rejection:', event.reason);
}); 