'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  SkipBack, 
  SkipForward, 
  FastForward,
  Rewind,
  Clock,
  Calendar,
  Settings,
  RotateCcw,
  Zap
} from 'lucide-react';

interface ReplayState {
  isPlaying: boolean;
  isPaused: boolean;
  speed: number; // 1x, 2x, 4x, 8x
  currentTime: Date;
  startTime: Date;
  endTime: Date;
  duration: number; // in seconds
  progress: number; // 0-100%
  marketHours: {
    start: string; // "09:30"
    end: string;   // "17:00"
  };
}

interface ReplayControlsProps {
  sessionId: string;
  replayDay: string;
  isInstructor: boolean;
  onReplayStateChange?: (state: ReplayState) => void;
  onTickGenerated?: (tick: any) => void;
}

export default function ReplayControls({
  sessionId,
  replayDay,
  isInstructor,
  onReplayStateChange,
  onTickGenerated
}: ReplayControlsProps) {
  const [replayState, setReplayState] = useState<ReplayState>({
    isPlaying: false,
    isPaused: false,
    speed: 1,
    currentTime: new Date(`${replayDay}T09:30:00`),
    startTime: new Date(`${replayDay}T09:30:00`),
    endTime: new Date(`${replayDay}T17:00:00`),
    duration: 7.5 * 60 * 60, // 7.5 hours in seconds
    progress: 0,
    marketHours: {
      start: '09:30',
      end: '17:00'
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customSpeed, setCustomSpeed] = useState(1);
  
  const replayTimer = useRef<NodeJS.Timeout | null>(null);
  const replayEngineRef = useRef<any>(null);

  // Initialize replay engine
  useEffect(() => {
    const initReplayEngine = async () => {
      try {
        const { ReplayEngine } = await import('../../packages/shared/src/replay/ReplayEngine');
        const { MockDataProvider } = await import('../../packages/shared/src/providers/MockDataProvider');
        
        const dataProvider = new MockDataProvider();
        replayEngineRef.current = new ReplayEngine(dataProvider);
        
        // Load historical day
        await replayEngineRef.current.loadDay(replayDay);
        console.log('Replay engine initialized for day:', replayDay);
      } catch (error) {
        console.error('Failed to initialize replay engine:', error);
      }
    };

    initReplayEngine();
  }, [replayDay]);

  // Start replay
  const startReplay = async () => {
    if (!replayEngineRef.current || !isInstructor) return;

    setIsLoading(true);
    try {
      await replayEngineRef.current.startReplay(replayState.speed, (tick: any) => {
        // Update current time based on tick timestamp
        const tickTime = new Date(tick.timestamp);
        updateReplayState(tickTime, true, false);
        
        // Broadcast tick to participants
        if (onTickGenerated) {
          onTickGenerated(tick);
        }
      });
      
      // Start the time progression timer
      startReplayTimer();
    } catch (error) {
      console.error('Failed to start replay:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Pause replay
  const pauseReplay = async () => {
    if (!replayEngineRef.current || !isInstructor) return;

    await replayEngineRef.current.pauseReplay();
    stopReplayTimer();
    updateReplayState(replayState.currentTime, false, true);
  };

  // Stop replay
  const stopReplay = async () => {
    if (!replayEngineRef.current || !isInstructor) return;

    await replayEngineRef.current.stopReplay();
    stopReplayTimer();
    
    // Reset to start time
    const startTime = new Date(`${replayDay}T${replayState.marketHours.start}:00`);
    updateReplayState(startTime, false, false);
  };

  // Step replay (single tick)
  const stepReplay = async () => {
    if (!replayEngineRef.current || !isInstructor) return;

    try {
      const tick = await replayEngineRef.current.stepReplay();
      if (tick) {
        const tickTime = new Date(tick.timestamp);
        updateReplayState(tickTime, false, true);
        
        if (onTickGenerated) {
          onTickGenerated(tick);
        }
      }
    } catch (error) {
      console.error('Failed to step replay:', error);
    }
  };

  // Change replay speed
  const changeSpeed = async (newSpeed: number) => {
    if (!replayEngineRef.current) return;

    setReplayState(prev => ({ ...prev, speed: newSpeed }));
    
    if (replayState.isPlaying) {
      // Restart with new speed
      await replayEngineRef.current.pauseReplay();
      await replayEngineRef.current.startReplay(newSpeed, (tick: any) => {
        const tickTime = new Date(tick.timestamp);
        updateReplayState(tickTime, true, false);
        
        if (onTickGenerated) {
          onTickGenerated(tick);
        }
      });
      
      stopReplayTimer();
      startReplayTimer();
    }
  };

  // Seek to specific time
  const seekToTime = async (seekTime: Date) => {
    if (!replayEngineRef.current || !isInstructor) return;

    const wasPlaying = replayState.isPlaying;
    
    // Pause if playing
    if (wasPlaying) {
      await pauseReplay();
    }
    
    // Update state
    updateReplayState(seekTime, false, !wasPlaying);
    
    // TODO: Implement seek in replay engine
    // This would require loading data up to the seek point
    console.log('Seeking to:', seekTime);
  };

  // Start replay timer for UI updates
  const startReplayTimer = () => {
    if (replayTimer.current) {
      clearInterval(replayTimer.current);
    }
    
    replayTimer.current = setInterval(() => {
      setReplayState(prev => {
        const newTime = new Date(prev.currentTime.getTime() + (1000 * prev.speed));
        const progress = calculateProgress(newTime, prev.startTime, prev.endTime);
        
        // Auto-stop at end time
        if (newTime >= prev.endTime) {
          stopReplay();
          return prev;
        }
        
        return {
          ...prev,
          currentTime: newTime,
          progress
        };
      });
    }, 1000);
  };

  // Stop replay timer
  const stopReplayTimer = () => {
    if (replayTimer.current) {
      clearInterval(replayTimer.current);
      replayTimer.current = null;
    }
  };

  // Update replay state and notify parent
  const updateReplayState = (currentTime: Date, isPlaying: boolean, isPaused: boolean) => {
    const newState = {
      ...replayState,
      currentTime,
      isPlaying,
      isPaused,
      progress: calculateProgress(currentTime, replayState.startTime, replayState.endTime)
    };
    
    setReplayState(newState);
    
    if (onReplayStateChange) {
      onReplayStateChange(newState);
    }
  };

  // Calculate progress percentage
  const calculateProgress = (current: Date, start: Date, end: Date): number => {
    const totalMs = end.getTime() - start.getTime();
    const currentMs = Math.max(0, current.getTime() - start.getTime());
    return Math.min(100, (currentMs / totalMs) * 100);
  };

  // Format time for display
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('el-GR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Speed options
  const speedOptions = [0.25, 0.5, 1, 2, 4, 8];

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopReplayTimer();
      if (replayEngineRef.current) {
        replayEngineRef.current.stopReplay();
      }
    };
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Replay - {new Date(replayDay).toLocaleDateString('el-GR')}
            </h3>
          </div>
          
          {replayState.isPlaying && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm">
              <Zap className="w-3 h-3" />
              LIVE {replayState.speed}x
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-500">
            {formatTime(replayState.currentTime)} / {formatTime(replayState.endTime)}
          </div>
          
          {isInstructor && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Settings className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="p-4">
        <div className="relative">
          {/* Timeline */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${replayState.progress}%` }}
            />
          </div>
          
          {/* Time markers */}
          <div className="flex justify-between text-xs text-gray-500">
            <span>{replayState.marketHours.start}</span>
            <span>12:00</span>
            <span>{replayState.marketHours.end}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      {isInstructor && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center gap-2">
            {/* Reset */}
            <button
              onClick={stopReplay}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 disabled:opacity-50"
              title="Reset στην αρχή"
            >
              <RotateCcw className="w-5 h-5 text-gray-600" />
            </button>

            {/* Step Back */}
            <button
              onClick={() => {
                const newTime = new Date(replayState.currentTime.getTime() - 60000); // 1 minute back
                if (newTime >= replayState.startTime) {
                  seekToTime(newTime);
                }
              }}
              disabled={isLoading || replayState.currentTime <= replayState.startTime}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 disabled:opacity-50"
              title="1 λεπτό πίσω"
            >
              <SkipBack className="w-5 h-5 text-gray-600" />
            </button>

            {/* Play/Pause */}
            {!replayState.isPlaying ? (
              <button
                onClick={startReplay}
                disabled={isLoading}
                className="p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
                title="Έναρξη replay"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </button>
            ) : (
              <button
                onClick={pauseReplay}
                className="p-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg"
                title="Παύση"
              >
                <Pause className="w-5 h-5" />
              </button>
            )}

            {/* Stop */}
            <button
              onClick={stopReplay}
              disabled={!replayState.isPlaying && !replayState.isPaused}
              className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              title="Στοπ"
            >
              <Square className="w-5 h-5" />
            </button>

            {/* Step Forward */}
            <button
              onClick={stepReplay}
              disabled={isLoading || replayState.isPlaying}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 disabled:opacity-50"
              title="Step (μία κίνηση)"
            >
              <SkipForward className="w-5 h-5 text-gray-600" />
            </button>

            {/* Speed Control */}
            <div className="flex items-center gap-2 ml-4">
              <span className="text-sm text-gray-500">Ταχύτητα:</span>
              <select
                value={replayState.speed}
                onChange={(e) => changeSpeed(parseFloat(e.target.value))}
                disabled={isLoading}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              >
                {speedOptions.map(speed => (
                  <option key={speed} value={speed}>
                    {speed}x
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="mt-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Ρυθμίσεις Replay</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ώρα Έναρξης
                  </label>
                  <input
                    type="time"
                    value={replayState.marketHours.start}
                    onChange={(e) => {
                      const newStartTime = new Date(`${replayDay}T${e.target.value}:00`);
                      setReplayState(prev => ({
                        ...prev,
                        marketHours: { ...prev.marketHours, start: e.target.value },
                        startTime: newStartTime
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ώρα Λήξης
                  </label>
                  <input
                    type="time"
                    value={replayState.marketHours.end}
                    onChange={(e) => {
                      const newEndTime = new Date(`${replayDay}T${e.target.value}:00`);
                      setReplayState(prev => ({
                        ...prev,
                        marketHours: { ...prev.marketHours, end: e.target.value },
                        endTime: newEndTime
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Non-instructor view */}
      {!isInstructor && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <Clock className="w-6 h-6 mx-auto mb-2" />
            <p className="text-sm">
              Replay ελέγχεται από τον εκπαιδευτή
            </p>
            <p className="text-xs mt-1">
              Τρέχουσα ώρα: {formatTime(replayState.currentTime)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
