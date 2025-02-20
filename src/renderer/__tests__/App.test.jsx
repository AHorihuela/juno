import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App Component', () => {
  it('renders hello world message', () => {
    render(<App />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });
}); 