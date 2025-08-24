import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OptionChain from '../OptionChain';

// Mock Supabase
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}));

describe('OptionChain Component', () => {
  const mockProps = {
    sessionId: 'test-session',
    instruments: [
      {
        type: 'OPTION',
        expiries: [
          {
            date: '2024-09-30',
            strikes: [80, 82.5, 85, 87.5, 90],
          },
        ],
      },
    ],
    ticks: [
      { symbol: 'BRN', mid: 82.5, bid: 82.4, ask: 82.6 },
    ],
    onOrderSubmit: vi.fn(),
  };

  it('renders option chain correctly', () => {
    render(<OptionChain {...mockProps} />);
    
    // Check for expiry selector
    expect(screen.getByText(/Expiry:/)).toBeInTheDocument();
    
    // Check for strikes header
    expect(screen.getByText('Strike')).toBeInTheDocument();
    expect(screen.getByText('Call Bid')).toBeInTheDocument();
    expect(screen.getByText('Call Ask')).toBeInTheDocument();
    expect(screen.getByText('Put Bid')).toBeInTheDocument();
    expect(screen.getByText('Put Ask')).toBeInTheDocument();
  });

  it('displays strikes correctly', () => {
    render(<OptionChain {...mockProps} />);
    
    // Check for strike prices
    expect(screen.getByText('80.00')).toBeInTheDocument();
    expect(screen.getByText('82.50')).toBeInTheDocument();
    expect(screen.getByText('85.00')).toBeInTheDocument();
  });

  it('highlights ATM strike', () => {
    render(<OptionChain {...mockProps} />);
    
    // Strike 82.5 should be highlighted as ATM (closest to BRN price of 82.5)
    const atmRow = screen.getByText('82.50').closest('tr');
    expect(atmRow).toHaveClass('bg-blue-50');
  });

  it('handles strike selection', () => {
    render(<OptionChain {...mockProps} />);
    
    // Click on a strike
    const strikeButton = screen.getByText('85.00');
    fireEvent.click(strikeButton);
    
    // Check if selection is highlighted
    const selectedRow = strikeButton.closest('tr');
    expect(selectedRow).toHaveClass('ring-2');
  });

  it('opens order modal on bid/ask click', () => {
    render(<OptionChain {...mockProps} />);
    
    // Click on a call bid button
    const bidButtons = screen.getAllByText(/2\.\d{2}/);
    fireEvent.click(bidButtons[0]);
    
    // Check if order modal appears
    expect(screen.getByText('Submit Order')).toBeInTheDocument();
  });

  it('submits order correctly', () => {
    render(<OptionChain {...mockProps} />);
    
    // Open order modal
    const bidButtons = screen.getAllByText(/2\.\d{2}/);
    fireEvent.click(bidButtons[0]);
    
    // Fill in quantity
    const quantityInput = screen.getByPlaceholderText('Quantity');
    fireEvent.change(quantityInput, { target: { value: '10' } });
    
    // Submit order
    const submitButton = screen.getByText('Submit Order');
    fireEvent.click(submitButton);
    
    // Check if callback was called
    expect(mockProps.onOrderSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 10,
      })
    );
  });

  it('displays IV correctly', () => {
    render(<OptionChain {...mockProps} />);
    
    // Check for IV values
    const ivElements = screen.getAllByText(/\d+\.\d%/);
    expect(ivElements.length).toBeGreaterThan(0);
  });

  it('filters by moneyness', () => {
    render(<OptionChain {...mockProps} />);
    
    // Initially all strikes should be visible
    expect(screen.getAllByText(/\d+\.\d{2}/).length).toBeGreaterThan(0);
    
    // Click ITM filter
    const itmButton = screen.getByText('ITM');
    fireEvent.click(itmButton);
    
    // Should filter strikes (exact count depends on BRN price)
    expect(screen.getAllByText(/\d+\.\d{2}/).length).toBeLessThanOrEqual(5);
  });
});
