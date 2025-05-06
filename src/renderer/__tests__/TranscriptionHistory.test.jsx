import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TranscriptionHistory from '../components/TranscriptionHistory';

// Mock the getIpcRenderer utility
jest.mock('../utils/electron', () => ({
  getIpcRenderer: () => ({
    send: jest.fn(),
    on: jest.fn(() => jest.fn()), // Return a mock unsubscribe function
    removeAllListeners: jest.fn()
  })
}));

describe('TranscriptionHistory Component', () => {
  test('shows empty state when no transcriptions exist', () => {
    render(<TranscriptionHistory />);
    expect(screen.getByText('No transcriptions yet')).toBeInTheDocument();
  });
}); 