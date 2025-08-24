'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import { ArrowRight, Play, Users, Settings } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<'create' | 'join'>('join');
  const [sessionId, setSessionId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Create session form state
  const [sessionConfig, setSessionConfig] = useState({
    mode: 'live' as 'live' | 'replay',
    bankroll: 100000,
    varLimit: 5000,
    maxPlayers: 25,
    replayDay: '',
    replaySpeed: 1,
  });

  const handleCreateSession = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/functions/session-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          mode: sessionConfig.mode,
          bankroll: sessionConfig.bankroll,
          var_limit: sessionConfig.varLimit,
          replay_day: sessionConfig.replayDay || undefined,
          replay_speed: sessionConfig.replaySpeed,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create session');
      }

      toast.success('Session created successfully!');
      router.push(`/session/${data.sessionId}`);
    } catch (error) {
      toast.error((error as any).message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSession = async () => {
    if (!sessionId.trim() || !displayName.trim()) {
      toast.error('Please enter session ID and display name');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/functions/session-join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          sessionId: sessionId.trim(),
          display_name: displayName.trim(),
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to join session');
      }

      toast.success('Joined session successfully!');
      router.push(`/session/${sessionId}`);
    } catch (error) {
      toast.error((error as any).message || 'Failed to join session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
            ICE Brent Options Training
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Practice trading EU-style Brent options with Black-76 pricing
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setMode('join')}
              className={`flex-1 px-6 py-5 text-center font-bold transition-all duration-300 ${
                mode === 'join'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg transform scale-105'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50/50'
              }`}
            >
              <Users className="inline-block w-5 h-5 mr-2" />
              Join Session
            </button>
            <button
              onClick={() => setMode('create')}
              className={`flex-1 px-6 py-5 text-center font-bold transition-all duration-300 ${
                mode === 'create'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg transform scale-105'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50/50'
              }`}
            >
              <Settings className="inline-block w-5 h-5 mr-2" />
              Create Session
            </button>
          </div>

          <div className="p-6">
            {mode === 'join' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Session ID
                  </label>
                  <input
                    type="text"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    placeholder="Enter session ID"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your display name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <button
                  onClick={handleJoinSession}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    'Joining...'
                  ) : (
                    <>
                      Join Session
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Session Mode
                    </label>
                    <select
                      value={sessionConfig.mode}
                      onChange={(e) => setSessionConfig({ ...sessionConfig, mode: e.target.value as 'live' | 'replay' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="live">Live (15-min delayed)</option>
                      <option value="replay">Replay Historical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Starting Bankroll
                    </label>
                    <input
                      type="number"
                      value={sessionConfig.bankroll}
                      onChange={(e) => setSessionConfig({ ...sessionConfig, bankroll: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      VaR Limit (95% confidence)
                    </label>
                    <input
                      type="number"
                      value={sessionConfig.varLimit}
                      onChange={(e) => setSessionConfig({ ...sessionConfig, varLimit: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max Players
                    </label>
                    <input
                      type="number"
                      value={sessionConfig.maxPlayers}
                      onChange={(e) => setSessionConfig({ ...sessionConfig, maxPlayers: parseInt(e.target.value) })}
                      min="1"
                      max="25"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                </div>

                {sessionConfig.mode === 'replay' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Replay Date
                      </label>
                      <input
                        type="date"
                        value={sessionConfig.replayDay}
                        onChange={(e) => setSessionConfig({ ...sessionConfig, replayDay: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Replay Speed
                      </label>
                      <select
                        value={sessionConfig.replaySpeed}
                        onChange={(e) => setSessionConfig({ ...sessionConfig, replaySpeed: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value="1">1x (Real-time)</option>
                        <option value="2">2x</option>
                        <option value="4">4x</option>
                        <option value="8">8x</option>
                      </select>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleCreateSession}
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    'Creating...'
                  ) : (
                    <>
                      Create Session
                      <Play className="ml-2 w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Contract: 1,000 bbl • Tick: $0.01/bbl • European exercise</p>
          <p>Model: Black-76 • Greeks: Δ, Γ, ν, Θ, Vanna, Vomma</p>
        </div>
      </div>
    </div>
  );
}