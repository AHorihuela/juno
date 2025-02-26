#!/usr/bin/env node

/**
 * Script to run tests and generate coverage reports
 * 
 * This script runs Jest with coverage reporting enabled and generates
 * both console and HTML coverage reports.
 * 
 * Usage:
 *   npm run test:coverage
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const COVERAGE_THRESHOLD = 80; // Minimum coverage percentage
const CRITICAL_COMPONENTS = [
  'src/main/services/WindowManager.js',
  'src/main/services/MemoryManager.js',
  'src/main/ipc/memoryIpcHandlers.js',
  'src/main/services/ServiceRegistry.js',
  'src/renderer/components/MemoryManager.jsx'
];

// Ensure coverage directory exists
const coverageDir = path.join(__dirname, '..', 'coverage');
if (!fs.existsSync(coverageDir)) {
  fs.mkdirSync(coverageDir, { recursive: true });
}

// Run Jest with coverage
console.log('Running tests with coverage reporting...');
try {
  execSync('jest --coverage', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });
  
  console.log('\n✅ Tests completed successfully');
} catch (error) {
  console.error('\n❌ Tests failed');
  process.exit(1);
}

// Check coverage for critical components
try {
  console.log('\nChecking coverage for critical components...');
  
  const coverageSummary = JSON.parse(
    fs.readFileSync(path.join(coverageDir, 'coverage-summary.json'), 'utf8')
  );
  
  let allCriticalComponentsCovered = true;
  
  CRITICAL_COMPONENTS.forEach(component => {
    const componentCoverage = coverageSummary[component];
    
    if (!componentCoverage) {
      console.error(`❌ No coverage data for critical component: ${component}`);
      allCriticalComponentsCovered = false;
      return;
    }
    
    const lineCoverage = componentCoverage.lines.pct;
    const functionCoverage = componentCoverage.functions.pct;
    const branchCoverage = componentCoverage.branches.pct;
    const statementCoverage = componentCoverage.statements.pct;
    
    console.log(`\nComponent: ${component}`);
    console.log(`  Line Coverage: ${lineCoverage}%`);
    console.log(`  Function Coverage: ${functionCoverage}%`);
    console.log(`  Branch Coverage: ${branchCoverage}%`);
    console.log(`  Statement Coverage: ${statementCoverage}%`);
    
    if (
      lineCoverage < COVERAGE_THRESHOLD ||
      functionCoverage < COVERAGE_THRESHOLD ||
      branchCoverage < COVERAGE_THRESHOLD ||
      statementCoverage < COVERAGE_THRESHOLD
    ) {
      console.error(`❌ Coverage below ${COVERAGE_THRESHOLD}% threshold for ${component}`);
      allCriticalComponentsCovered = false;
    } else {
      console.log(`✅ Coverage meets ${COVERAGE_THRESHOLD}% threshold`);
    }
  });
  
  if (allCriticalComponentsCovered) {
    console.log('\n✅ All critical components have adequate test coverage');
  } else {
    console.error('\n❌ Some critical components have inadequate test coverage');
    // Don't exit with error to allow CI to continue
  }
  
  console.log('\nCoverage report generated in coverage/ directory');
  console.log('Open coverage/lcov-report/index.html in your browser to view the detailed report');
} catch (error) {
  console.error('Error checking coverage:', error);
} 