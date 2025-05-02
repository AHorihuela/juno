#!/usr/bin/env node

/**
 * Utility to check paste logs for debugging
 * 
 * This script reads and displays the paste operation logs
 * to help diagnose text insertion issues.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Configure the log file path
const LOG_PATH = path.join(os.tmpdir(), 'juno-paste-log.txt');

// Read the log file
function readLog() {
  try {
    if (!fs.existsSync(LOG_PATH)) {
      console.error(`Log file not found at: ${LOG_PATH}`);
      return null;
    }
    
    const content = fs.readFileSync(LOG_PATH, 'utf8');
    return content;
  } catch (error) {
    console.error('Error reading log file:', error);
    return null;
  }
}

// Print log with formatting
function printFormattedLog(logContent) {
  if (!logContent) {
    return;
  }
  
  // Split by entries (double newline)
  const entries = logContent.split('\n\n');
  
  // Print header
  console.log('\n=== Juno Paste Operation Log Analysis ===\n');
  console.log(`Total entries: ${entries.length - 1}`); // Subtract 1 for header
  console.log(`Log file: ${LOG_PATH}\n`);
  
  // Print operations
  let operationCount = 0;
  let errorCount = 0;
  let successCount = 0;
  
  for (const entry of entries) {
    // Skip empty entries
    if (!entry.trim()) continue;
    
    // Skip the header
    if (entry.includes('=== Juno Paste Operations Log ===')) {
      console.log('Log started at:', entry.split('\n')[1].replace('Started at: ', ''));
      console.log('-------------------------------------------\n');
      continue;
    }
    
    // Count operations
    operationCount++;
    
    // Check for errors and successes
    if (entry.includes('ERROR') || entry.includes('FAILED')) {
      errorCount++;
      console.log(`❌ ${entry.split('\n')[0]}`);
      
      // Print error details
      const details = entry.split('\n').slice(1).filter(line => line.trim());
      details.forEach(detail => console.log(`   ${detail}`));
    } else if (entry.includes('SUCCESS')) {
      successCount++;
      console.log(`✅ ${entry.split('\n')[0]}`);
    } else {
      // Just print the operation name for other entries
      console.log(`ℹ️ ${entry.split('\n')[0]}`);
    }
  }
  
  // Print summary
  console.log('\n-------------------------------------------');
  console.log('Summary:');
  console.log(`- Total operations: ${operationCount}`);
  console.log(`- Successful operations: ${successCount}`);
  console.log(`- Error operations: ${errorCount}`);
  console.log('-------------------------------------------\n');
}

// Main function
function main() {
  const logContent = readLog();
  
  if (logContent) {
    printFormattedLog(logContent);
  } else {
    console.log('No paste log found. Run text insertion test first to generate logs.');
  }
}

// Run the main function
main(); 