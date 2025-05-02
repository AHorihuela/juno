#!/bin/bash

# Run text insertion test script
echo "Running text insertion test..."
echo "Please ensure you have a text editor open to verify the results."

# Set NODE_ENV to development to enable debugging
export NODE_ENV=development

# Run the test with electron
npx electron scripts/test-text-insertion.js

echo "Test completed." 