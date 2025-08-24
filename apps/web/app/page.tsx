'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function HomePage() {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [sessionId, setSessionId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // For now, mock the session creation
      const mockSessionId = `session-${Date.now()}`;
      window.location.href = `/session/${mockSessionId}`;
    } catch (err) {
      setError('Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!sessionId || !displayName) {
        setError('Please enter session ID and display name');
        return;
      }
      window.location.href = `/session/${sessionId}`;
    } catch (err) {
      setError('Failed to join session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-brent-dark mb-2">
              Commodity Options Training Game
            </h1>
            <p className="text-gray-600">ICE Brent Futures & Options (Black-76)</p>
          </div>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('create')}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                mode === 'create'
                  ? 'bg-brent-blue text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Create Session
            </button>
            <button
              onClick={() => setMode('join')}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                mode === 'join'
                  ? 'bg-brent-blue text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Join Session
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          {mode === 'create' ? (
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session Mode
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brent-blue">
                  <option value="live">Live (15-min delayed)</option>
                  <option value="replay">Replay Historical Day</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Starting Bankroll
                </label>
                <input
                  type="number"
                  defaultValue={100000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brent-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VaR Limit (95%)
                </label>
                <input
                  type="number"
                  defaultValue={5000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brent-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Players
                </label>
                <input
                  type="number"
                  defaultValue={25}
                  min={1}
                  max={25}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brent-blue"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brent-blue text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Session'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session ID
                </label>
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="Enter session ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brent-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brent-blue"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brent-blue text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? 'Joining...' : 'Join Session'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Educational use only • Not for production trading
              <br />
              Prices are 15-min delayed • EU data residency
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}