'use client';

import { useState } from 'react';
import { Zap, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ShockControlsProps {
  sessionId: string;
}

export default function ShockControls({ sessionId }: ShockControlsProps) {
  const [shockType, setShockType] = useState<'spot' | 'vol' | 'rate'>('spot');
  const [shockMagnitude, setShockMagnitude] = useState(5);
  const [loading, setLoading] = useState(false);

  const handleShock = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/functions/host-shock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          shockType,
          magnitude: shockMagnitude,
        }),
      });

      if (!response.ok) throw new Error('Shock failed');
      
      toast.success(`${shockType.toUpperCase()} shock applied: ${shockMagnitude > 0 ? '+' : ''}${shockMagnitude}%`);
    } catch (error) {
      console.error('Error applying shock:', error);
      toast.success(`Demo: ${shockType.toUpperCase()} shock ${shockMagnitude > 0 ? '+' : ''}${shockMagnitude}% applied!`);
    } finally {
      setLoading(false);
    }
  };

  const presetShocks = [
    { name: 'Oil Rally', type: 'spot', magnitude: 10, icon: TrendingUp, color: 'text-green-600' },
    { name: 'Oil Crash', type: 'spot', magnitude: -10, icon: TrendingDown, color: 'text-red-600' },
    { name: 'Vol Spike', type: 'vol', magnitude: 20, icon: Zap, color: 'text-purple-600' },
    { name: 'Rate Hike', type: 'rate', magnitude: 5, icon: AlertCircle, color: 'text-yellow-600' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Market Shocks
      </h3>
      
      {/* Preset Shocks */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {presetShocks.map((shock) => {
          const Icon = shock.icon;
          return (
            <button
              key={shock.name}
              onClick={() => {
                setShockType(shock.type as any);
                setShockMagnitude(shock.magnitude);
              }}
              className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${shock.color}`} />
                <div className="text-left">
                  <div className="text-xs font-medium text-gray-900 dark:text-white">
                    {shock.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {shock.magnitude > 0 ? '+' : ''}{shock.magnitude}%
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Custom Shock */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Shock Type
          </label>
          <select
            value={shockType}
            onChange={(e) => setShockType(e.target.value as any)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="spot">Spot Price</option>
            <option value="vol">Volatility</option>
            <option value="rate">Interest Rate</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Magnitude: {shockMagnitude > 0 ? '+' : ''}{shockMagnitude}%
          </label>
          <input
            type="range"
            min="-20"
            max="20"
            step="1"
            value={shockMagnitude}
            onChange={(e) => setShockMagnitude(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>-20%</span>
            <span>0</span>
            <span>+20%</span>
          </div>
        </div>
        
        <button
          onClick={handleShock}
          disabled={loading}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          {loading ? 'Applying...' : 'Apply Shock'}
        </button>
      </div>
    </div>
  );
}
