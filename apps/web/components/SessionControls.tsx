'use client';

import { Play, Pause, Square, RotateCcw } from 'lucide-react';

interface SessionData {
  status: 'setup' | 'active' | 'paused' | 'completed';
}

interface SessionControlsProps {
  session: SessionData;
  onControl: (action: 'start' | 'pause' | 'resume' | 'stop') => void;
}

export default function SessionControls({ session, onControl }: SessionControlsProps) {
  return (
    <div className="flex items-center gap-2">
      {session.status === 'setup' && (
        <button
          onClick={() => onControl('start')}
          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Play className="w-4 h-4" />
          Start
        </button>
      )}
      
      {session.status === 'active' && (
        <>
          <button
            onClick={() => onControl('pause')}
            className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
          >
            <Pause className="w-4 h-4" />
            Pause
          </button>
          <button
            onClick={() => onControl('stop')}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Square className="w-4 h-4" />
            Stop
          </button>
        </>
      )}
      
      {session.status === 'paused' && (
        <>
          <button
            onClick={() => onControl('resume')}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Play className="w-4 h-4" />
            Resume
          </button>
          <button
            onClick={() => onControl('stop')}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Square className="w-4 h-4" />
            Stop
          </button>
        </>
      )}
      
      {session.status === 'completed' && (
        <button
          onClick={() => onControl('start')}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RotateCcw className="w-4 h-4" />
          Restart
        </button>
      )}
    </div>
  );
}
