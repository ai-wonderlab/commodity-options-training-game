'use client';

import React from 'react';
import { cn, cardStyles, tableStyles, badgeStyles, formatNumber, formatPercent } from '../lib/utils';
import { Settings, ChevronUp, ChevronDown, TrendingUp, Info } from 'lucide-react';

interface Instrument {
  symbol: string;
  type: 'CALL' | 'PUT';
  strike: number;
  expiry: string;
}

interface Tick {
  bid: number;
  ask: number;
  mid: number;
  last?: number;
  iv?: number;
}

interface OptionChainProps {
  instruments?: Instrument[];
  ticks?: Record<string, Tick>;
}

export default function OptionChain({ instruments = [], ticks = {} }: OptionChainProps) {
  const [selectedExpiry, setSelectedExpiry] = React.useState<string>('');
  const [showIV, setShowIV] = React.useState(true);
  const [sortBy, setSortBy] = React.useState<'strike' | 'volume'>('strike');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc');
  
  // Get unique expiries
  const expiries = React.useMemo(() => {
    const uniqueExpiries = [...new Set(instruments.map(i => i.expiry))].sort();
    return uniqueExpiries;
  }, [instruments]);
  
  // Set default expiry if not selected
  React.useEffect(() => {
    if (expiries.length > 0 && (!selectedExpiry || !expiries.includes(selectedExpiry))) {
      setSelectedExpiry(expiries[0]);
    }
  }, [expiries, selectedExpiry]);
  
  // Filter instruments for selected expiry
  const filteredInstruments = React.useMemo(() => {
    return instruments.filter(i => i.expiry === selectedExpiry);
  }, [instruments, selectedExpiry]);
  
  // Get unique strikes
  const strikes = React.useMemo(() => {
    const uniqueStrikes = [...new Set(filteredInstruments.map(i => i.strike))];
    return uniqueStrikes.sort((a, b) => {
      if (sortBy === 'strike') {
        return sortOrder === 'asc' ? a - b : b - a;
      }
      return 0;
    });
  }, [filteredInstruments, sortBy, sortOrder]);
  
  // Calculate ATM strike
  const atmStrike = React.useMemo(() => {
    const spotPrice = ticks['BRN']?.mid || 82.50;
    if (strikes.length === 0) return 85;
    return strikes.reduce((prev, curr) => 
      Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
    );
  }, [strikes, ticks]);

  const formatPrice = (value?: number) => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(2);
  };

  const formatIV = (value?: number) => {
    if (value === null || value === undefined) return '-';
    return (value * 100).toFixed(1) + '%';
  };

  // IV visualization helper
  const getIVBar = (iv?: number) => {
    if (!iv) return null;
    const ivPercent = Math.min(iv * 100, 100);
    return (
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-info to-info/60 transition-all duration-300"
          style={{ width: `${ivPercent}%` }}
        />
      </div>
    );
  };

  const toggleSort = (column: 'strike' | 'volume') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  return (
    <div className={cn(cardStyles.base, "h-full flex flex-col")}>
      <div className={cardStyles.header}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-h4 font-serif font-bold text-foreground">
              Option Chain
            </h3>
            <p className="text-caption text-muted-foreground mt-1">
              EU-Style Brent Options (BUL)
            </p>
          </div>
          <button className="p-2 rounded-md hover:bg-muted transition-colors">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <select
            value={selectedExpiry}
            onChange={(e) => setSelectedExpiry(e.target.value)}
            className="flex-1 px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {expiries.map((exp) => (
              <option key={exp} value={exp}>
                Expiry: {exp}
              </option>
            ))}
          </select>
          
          <label className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-input bg-background cursor-pointer hover:bg-muted transition-colors">
            <input
              type="checkbox"
              checked={showIV}
              onChange={(e) => setShowIV(e.target.checked)}
              className="rounded border-input text-primary focus:ring-primary"
            />
            <span>Show IV</span>
            <Info className="h-3 w-3 text-muted-foreground" />
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className={tableStyles.wrapper}>
          <table className={tableStyles.table}>
            <thead className={cn(tableStyles.header, "sticky top-0 bg-background z-10")}>
              <tr className={tableStyles.headerRow}>
                <th colSpan={showIV ? 5 : 4} className="text-center py-3 font-serif text-success">
                  CALLS
                </th>
                <th 
                  className="text-center py-3 bg-muted font-serif cursor-pointer hover:bg-muted/80"
                  onClick={() => toggleSort('strike')}
                >
                  <div className="flex items-center justify-center gap-1">
                    STRIKE
                    {sortBy === 'strike' && (
                      sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th colSpan={showIV ? 5 : 4} className="text-center py-3 font-serif text-destructive">
                  PUTS
                </th>
              </tr>
              <tr className="text-xs text-muted-foreground">
                {/* Calls */}
                <th className={tableStyles.headerCell}>Bid</th>
                <th className={tableStyles.headerCell}>Ask</th>
                <th className={tableStyles.headerCell}>Mid</th>
                {showIV && <th className={tableStyles.headerCell}>IV</th>}
                <th className={tableStyles.headerCell}>Vol</th>
                
                {/* Strike */}
                <th className="bg-muted"></th>
                
                {/* Puts */}
                <th className={tableStyles.headerCell}>Bid</th>
                <th className={tableStyles.headerCell}>Ask</th>
                <th className={tableStyles.headerCell}>Mid</th>
                {showIV && <th className={tableStyles.headerCell}>IV</th>}
                <th className={tableStyles.headerCell}>Vol</th>
              </tr>
            </thead>
            <tbody className={tableStyles.body}>
              {strikes.map((strike) => {
                const isATM = strike === atmStrike;
                const callSymbol = `BUL-${selectedExpiry}-C-${strike}`;
                const putSymbol = `BUL-${selectedExpiry}-P-${strike}`;
                
                const callTick = ticks[callSymbol];
                const putTick = ticks[putSymbol];
                const volume = Math.floor(Math.random() * 100);

                return (
                  <tr 
                    key={strike}
                    className={cn(
                      tableStyles.row,
                      "transition-all duration-200",
                      isATM && "bg-primary/5 dark:bg-primary/10 font-semibold animate-fade-in"
                    )}
                  >
                    {/* Calls */}
                    <td className={cn(tableStyles.cell, "text-right font-mono text-success")}>
                      {formatPrice(callTick?.bid)}
                    </td>
                    <td className={cn(tableStyles.cell, "text-right font-mono text-success/80")}>
                      {formatPrice(callTick?.ask)}
                    </td>
                    <td className={cn(tableStyles.cell, "text-right font-mono")}>
                      {formatPrice(callTick?.mid)}
                    </td>
                    {showIV && (
                      <td className={cn(tableStyles.cell, "px-2")}>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs text-muted-foreground">
                            {formatIV(callTick?.iv)}
                          </span>
                          {getIVBar(callTick?.iv)}
                        </div>
                      </td>
                    )}
                    <td className={cn(tableStyles.cell, "text-right text-muted-foreground")}>
                      {volume}
                    </td>
                    
                    {/* Strike */}
                    <td className={cn(
                      tableStyles.cell,
                      "text-center font-mono font-bold bg-muted",
                      isATM && "bg-primary text-primary-foreground"
                    )}>
                      <div className="flex items-center justify-center gap-1">
                        {strike.toFixed(0)}
                        {isATM && (
                          <span className={cn(badgeStyles.base, badgeStyles.variants.default, "text-xs py-0 px-1")}>
                            ATM
                          </span>
                        )}
                      </div>
                    </td>
                    
                    {/* Puts */}
                    <td className={cn(tableStyles.cell, "text-right font-mono text-destructive")}>
                      {formatPrice(putTick?.bid)}
                    </td>
                    <td className={cn(tableStyles.cell, "text-right font-mono text-destructive/80")}>
                      {formatPrice(putTick?.ask)}
                    </td>
                    <td className={cn(tableStyles.cell, "text-right font-mono")}>
                      {formatPrice(putTick?.mid)}
                    </td>
                    {showIV && (
                      <td className={cn(tableStyles.cell, "px-2")}>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs text-muted-foreground">
                            {formatIV(putTick?.iv)}
                          </span>
                          {getIVBar(putTick?.iv)}
                        </div>
                      </td>
                    )}
                    <td className={cn(tableStyles.cell, "text-right text-muted-foreground")}>
                      {volume}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}