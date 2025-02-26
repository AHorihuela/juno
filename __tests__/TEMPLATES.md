# Test Templates

This document provides templates for writing different types of tests in the Juno application. Use these templates as starting points to ensure consistency across the test suite.

## Service Test Template

```javascript
const ServiceName = require('../../src/main/services/ServiceName');
const { resetElectronMocks } = require('../helpers/electron-test-utils');

// Mock dependencies
jest.mock('../../src/main/services/DependencyService');
const DependencyService = require('../../src/main/services/DependencyService');

describe('ServiceName', () => {
  let service;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    resetElectronMocks();
    
    // Setup mocks
    DependencyService.mockImplementation(() => ({
      methodName: jest.fn().mockResolvedValue('mockResult'),
    }));
    
    // Create service instance
    service = new ServiceName();
  });
  
  afterEach(() => {
    // Clean up
    service.shutdown && service.shutdown();
  });
  
  describe('Initialization', () => {
    it('should initialize with correct default values', () => {
      expect(service.propertyName).toBe(expectedValue);
    });
    
    it('should initialize and shutdown without errors', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
      await expect(service.shutdown()).resolves.not.toThrow();
    });
  });
  
  describe('Method Group', () => {
    it('should perform expected action', async () => {
      // Arrange
      const input = 'testInput';
      
      // Act
      const result = await service.methodName(input);
      
      // Assert
      expect(result).toBe(expectedValue);
      expect(DependencyService().methodName).toHaveBeenCalledWith(input);
    });
    
    it('should handle errors', async () => {
      // Arrange
      const error = new Error('Test error');
      DependencyService().methodName.mockRejectedValueOnce(error);
      
      // Act & Assert
      await expect(service.methodName('input')).rejects.toThrow('Test error');
    });
  });
  
  describe('Event Handling', () => {
    it('should emit events correctly', () => {
      // Arrange
      const listener = jest.fn();
      service.on('eventName', listener);
      
      // Act
      service.triggerEvent();
      
      // Assert
      expect(listener).toHaveBeenCalledWith(expectedEventData);
    });
  });
});
```

## React Component Test Template

```jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComponentName from '../../src/renderer/components/ComponentName';

// Mock dependencies
jest.mock('../../src/renderer/services/ServiceName', () => ({
  methodName: jest.fn().mockResolvedValue('mockResult'),
}));

// Mock electron IPC
jest.mock('electron', () => ({
  ipcRenderer: {
    invoke: jest.fn().mockResolvedValue('mockResult'),
    on: jest.fn(),
    removeListener: jest.fn(),
  },
}));

describe('ComponentName', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });
  
  it('renders correctly with default props', () => {
    // Arrange & Act
    render(<ComponentName />);
    
    // Assert
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
  
  it('handles user interactions', async () => {
    // Arrange
    render(<ComponentName />);
    const button = screen.getByRole('button', { name: /button text/i });
    
    // Act
    userEvent.click(button);
    
    // Assert
    await waitFor(() => {
      expect(screen.getByText('Updated Text')).toBeInTheDocument();
    });
    expect(ServiceName.methodName).toHaveBeenCalledTimes(1);
  });
  
  it('handles async operations', async () => {
    // Arrange
    const mockData = { key: 'value' };
    ServiceName.methodName.mockResolvedValueOnce(mockData);
    render(<ComponentName />);
    
    // Act
    userEvent.click(screen.getByText('Load Data'));
    
    // Assert
    await waitFor(() => {
      expect(screen.getByText('value')).toBeInTheDocument();
    });
  });
  
  it('handles error states', async () => {
    // Arrange
    ServiceName.methodName.mockRejectedValueOnce(new Error('Test error'));
    render(<ComponentName />);
    
    // Act
    userEvent.click(screen.getByText('Load Data'));
    
    // Assert
    await waitFor(() => {
      expect(screen.getByText('Error: Test error')).toBeInTheDocument();
    });
  });
});
```

## IPC Handler Test Template

```javascript
const setupIpcHandlers = require('../../src/main/ipc/ipcHandlers');
const { ipcMain } = require('electron');
const ServiceRegistry = require('../../src/main/services/ServiceRegistry');

// Mock dependencies
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn(),
  },
}));

jest.mock('../../src/main/services/ServiceRegistry', () => ({
  getService: jest.fn(),
}));

describe('IPC Handlers', () => {
  let mockService;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mocks
    mockService = {
      methodName: jest.fn().mockResolvedValue('mockResult'),
    };
    
    ServiceRegistry.getService.mockImplementation((serviceName) => {
      if (serviceName === 'ServiceName') {
        return mockService;
      }
      return null;
    });
    
    // Setup IPC handlers
    setupIpcHandlers();
  });
  
  it('registers all expected handlers', () => {
    // Assert
    expect(ipcMain.handle).toHaveBeenCalledWith('channel-name', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledTimes(expectedNumberOfHandlers);
  });
  
  it('handles requests correctly', async () => {
    // Arrange
    const handler = ipcMain.handle.mock.calls.find(
      call => call[0] === 'channel-name'
    )[1];
    const event = {};
    const args = ['arg1', 'arg2'];
    
    // Act
    const result = await handler(event, ...args);
    
    // Assert
    expect(mockService.methodName).toHaveBeenCalledWith('arg1', 'arg2');
    expect(result).toBe('mockResult');
  });
  
  it('handles errors correctly', async () => {
    // Arrange
    const handler = ipcMain.handle.mock.calls.find(
      call => call[0] === 'channel-name'
    )[1];
    const event = {};
    const error = new Error('Test error');
    mockService.methodName.mockRejectedValueOnce(error);
    
    // Act & Assert
    await expect(handler(event, 'arg')).rejects.toThrow('Test error');
  });
});
```

## Utility Function Test Template

```javascript
const { utilityFunction } = require('../../src/common/utils/utilityModule');

describe('utilityFunction', () => {
  it('returns expected result for valid input', () => {
    // Arrange
    const input = 'testInput';
    const expectedOutput = 'expectedOutput';
    
    // Act
    const result = utilityFunction(input);
    
    // Assert
    expect(result).toBe(expectedOutput);
  });
  
  it('handles edge cases', () => {
    // Arrange & Act & Assert
    expect(utilityFunction(null)).toBeNull();
    expect(utilityFunction(undefined)).toBeUndefined();
    expect(utilityFunction('')).toBe('');
    expect(utilityFunction(0)).toBe(0);
  });
  
  it('throws error for invalid input', () => {
    // Arrange & Act & Assert
    expect(() => utilityFunction('invalid')).toThrow('Error message');
  });
});
```

## Integration Test Template

```javascript
const ServiceA = require('../../src/main/services/ServiceA');
const ServiceB = require('../../src/main/services/ServiceB');
const { resetElectronMocks } = require('../helpers/electron-test-utils');

// Mock external dependencies but not the services being tested
jest.mock('electron');
jest.mock('fs');

describe('Integration: ServiceA with ServiceB', () => {
  let serviceA;
  let serviceB;
  
  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    resetElectronMocks();
    
    // Create real service instances
    serviceA = new ServiceA();
    serviceB = new ServiceB();
    
    // Initialize services
    await serviceA.initialize();
    await serviceB.initialize();
    
    // Connect services
    serviceA.setDependency(serviceB);
  });
  
  afterEach(async () => {
    // Clean up
    await serviceA.shutdown();
    await serviceB.shutdown();
  });
  
  it('completes the full workflow', async () => {
    // Arrange
    const input = 'testInput';
    
    // Act
    const result = await serviceA.processWithDependency(input);
    
    // Assert
    expect(result).toEqual(expectedOutput);
    // Verify the interaction between services
    expect(serviceB.lastProcessedItem).toBe(input);
  });
  
  it('handles errors in the workflow', async () => {
    // Arrange
    const errorInput = 'errorTrigger';
    
    // Act & Assert
    await expect(serviceA.processWithDependency(errorInput)).rejects.toThrow();
    expect(serviceA.errorCount).toBe(1);
    expect(serviceB.errorCount).toBe(1);
  });
});
```

## Using These Templates

1. Copy the appropriate template for your test type
2. Replace placeholder names with actual names from your code
3. Adjust the test cases to match the actual behavior of your code
4. Add or remove test cases as needed
5. Update mock implementations to match your dependencies

Remember to follow the testing standards outlined in the TEST_PLAN.md document. 