// Test script for testing text insertion
const ServiceRegistry = require('../src/main/services/ServiceRegistry');
const path = require('path');

// Service factories
const TextInsertionService = require('../src/main/services/textInsertionService');
const ConfigService = require('../src/main/services/config/ConfigService');
const NotificationService = require('../src/main/services/notification/NotificationService');

async function testTextInsertion() {
  console.log('Starting text insertion test');
  
  // Create and initialize ServiceRegistry
  const registry = new ServiceRegistry();
  
  // Register required services
  registry.register('config', ConfigService());
  registry.register('notification', NotificationService());
  registry.register('textInsertion', TextInsertionService());
  
  // Initialize services
  await registry.initialize();
  
  const textInsertionService = registry.get('textInsertion');
  
  try {
    // Open a text editor first (TextEdit, VS Code, etc.)
    console.log('Please open a text editor and place cursor where text should be inserted');
    console.log('Waiting 5 seconds before insertion...');
    
    // Wait for 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Try text insertion
    console.log('Attempting to insert text...');
    const result = await textInsertionService.insertText('Test text insertion via direct call');
    
    console.log('Insertion result:', result);
  } catch (error) {
    console.error('Error during text insertion test:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  } finally {
    await registry.shutdown();
  }
}

testTextInsertion()
  .then(() => console.log('Test completed'))
  .catch(err => console.error('Test failed with error:', err))
  .finally(() => process.exit(0)); 