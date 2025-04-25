/**
 * Test script specifically for AI commands with highlighted text
 * 
 * This script tests:
 * 1. AI trigger keyword recognition
 * 2. Command keyword recognition
 * 3. Highlighted text handling for AI interactions
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// Import the logger for debugging
const logger = require('../src/main/logger');
logger.level = 'debug';

// Fake/sample audio data for tests
const TEST_TRANSCRIPTIONS = {
  aiTrigger: "ai, summarize the following",
  aiCommand: "explain the highlighted code",
  regularText: "This is just regular transcribed text"
};

// Service factories
let registry;
let aiService;
let configService;
let selectionService;
let transcriptionService;
let textInsertionService;

// Ensure app is ready
app.whenReady().then(async () => {
  try {
    await setupServices();
    await runTests();
  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    if (registry) {
      await registry.shutdown();
    }
    process.exit(0); // Force exit as some service may keep app running
  }
});

async function setupServices() {
  console.log('Setting up services for AI command testing...');
  
  try {
    // Load service modules
    const ServiceRegistry = require('../src/main/services/ServiceRegistry');
    const AIService = require('../src/main/services/ai/AIService');
    const TextInsertionService = require('../src/main/services/textInsertionService');
    const SelectionService = require('../src/main/services/selection/SelectionService');
    const TranscriptionService = require('../src/main/services/transcriptionService');
    const ConfigService = require('../src/main/services/config/ConfigService');
    const NotificationService = require('../src/main/services/notification/NotificationService');
    const ContextService = require('../src/main/services/context/ContextService');
    const TelemetryService = require('../src/main/services/telemetry/TelemetryService');
    
    // Create registry and register services
    registry = new ServiceRegistry();
    
    // Register all required services
    registry.register('config', ConfigService());
    registry.register('notification', NotificationService());
    registry.register('selection', SelectionService());
    registry.register('textInsertion', TextInsertionService());
    registry.register('transcription', TranscriptionService());
    registry.register('ai', AIService());
    registry.register('context', ContextService());
    registry.register('telemetry', TelemetryService({ shouldConnect: false }));
    
    // Initialize services
    console.log('Initializing services...');
    await registry.initialize();
    
    // Get services for testing
    aiService = registry.get('ai');
    configService = registry.get('config');
    selectionService = registry.get('selection');
    transcriptionService = registry.get('transcription');
    textInsertionService = registry.get('textInsertion');
    
    // Verify AI service is available
    if (!aiService) {
      throw new Error('AI service not available');
    }
    
    console.log('Services initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to set up services:', error);
    throw error;
  }
}

async function runTests() {
  try {
    console.log('\n==== Testing AI Command Functionality ====');
    
    // Test 1: Check if AI service recognizes AI commands
    console.log('\n1. Testing AI command recognition...');
    const isAITrigger = await aiService.isAICommand(TEST_TRANSCRIPTIONS.aiTrigger);
    const isAICommand = await aiService.isAICommand(TEST_TRANSCRIPTIONS.aiCommand);
    const isRegularText = await aiService.isAICommand(TEST_TRANSCRIPTIONS.regularText);
    
    console.log('AI trigger recognized:', isAITrigger);
    console.log('AI command recognized:', isAICommand);
    console.log('Regular text (should be false):', isRegularText);
    
    if (!isAITrigger || !isAICommand || isRegularText) {
      console.warn('AI command recognition test failed');
    }
    
    // Test 2: Get highlighted text
    console.log('\n2. Testing selection service...');
    console.log('Please select some text in your editor now');
    console.log('Waiting 5 seconds...');
    await sleep(5000);
    
    const selectedText = await selectionService.getSelectedText();
    console.log('Selected text detected:', selectedText ? 
      `"${selectedText.substring(0, 50)}${selectedText.length > 50 ? '...' : ''}" (${selectedText.length} chars)` : 
      'No selection detected');
    
    // Test 3: Process AI command with selection
    if (selectedText) {
      console.log('\n3. Testing AI command with selection...');
      console.log('Simulating AI processing with the highlighted text...');
      
      // Mock the AI service response for testing
      const originalProcessRequest = aiService.processRequest;
      aiService.processRequest = async () => {
        await sleep(1000); // Simulate processing time
        return `TEST RESPONSE: I've analyzed the text: "${selectedText.substring(0, 30)}..."`;
      };
      
      try {
        // Process the AI command with selection
        const result = await transcriptionService.processAndInsertText(TEST_TRANSCRIPTIONS.aiCommand);
        console.log('AI command processing result:', result || 'No result');
      } catch (error) {
        console.error('Error processing AI command:', error);
      } finally {
        // Restore original function
        aiService.processRequest = originalProcessRequest;
      }
    } else {
      console.log('Skipping AI command test due to missing selection');
    }
    
    // Test 4: Test complete flow with mock transcription
    console.log('\n4. Testing transcription service handling of AI commands...');
    console.log('Please select some text in your editor now');
    console.log('Waiting 5 seconds...');
    await sleep(5000);
    
    // Mock the transcription service to return our test transcription
    const originalTranscribe = transcriptionService.transcribeAudio;
    transcriptionService.transcribeAudio = async () => {
      return TEST_TRANSCRIPTIONS.aiCommand;
    };
    
    // Mock AI service for a predictable response
    aiService.processRequest = async (prompt, context) => {
      await sleep(1000); // Simulate processing time
      return `TEST RESPONSE: I've processed "${prompt}" with context length: ${context?.length || 0} chars`;
    };
    
    try {
      // Simulate audio processing with a dummy buffer
      const result = await transcriptionService.processAudio(Buffer.from('dummy audio data'));
      console.log('Full audio processing flow result:', result || 'No result');
    } catch (error) {
      console.error('Error in full audio processing flow:', error);
    } finally {
      // Restore original functions
      transcriptionService.transcribeAudio = originalTranscribe;
    }
    
    console.log('\nAI command tests completed!');
  } catch (error) {
    console.error('Tests failed with error:', error);
    throw error;
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
} 