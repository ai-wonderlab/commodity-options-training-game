'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function QuickNav() {
  const router = useRouter();
  const [testSessionId] = useState(`TEST-SESSION-${Date.now()}`);
  const [isExpanded, setIsExpanded] = useState(false); // Αρχικά minimized
  const [isHovered, setIsHovered] = useState(false);
  
  // Load saved state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('quicknav-expanded');
    if (saved !== null) {
      setIsExpanded(JSON.parse(saved));
    }
  }, []);

  // Save state to localStorage
  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem('quicknav-expanded', JSON.stringify(newState));
  };
  
  // Μόνο σε development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const navLinks = [
    { name: '🏠 Αρχική', path: '/', emoji: '🏠' },
    { name: '👨‍🏫 Instructor', path: '/instructor', emoji: '👨‍🏫' },
    { name: '📈 Trading', path: `/session/${testSessionId}`, emoji: '📈' },
    { name: '🏆 Debrief', path: `/session/${testSessionId}/debrief`, emoji: '🏆' },
  ];

  return (
    <div 
      style={{
        position: 'fixed',
        top: '70px',
        right: '20px',
        zIndex: 1000,
        transition: 'all 0.3s ease-in-out'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Minimized State */}
      {!isExpanded && (
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          transform: isHovered ? 'scale(1.1)' : 'scale(1)',
          transition: 'all 0.2s ease'
        }}
        onClick={toggleExpanded}
        title="Expand Quick Navigation"
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '3px',
            padding: '2px'
          }}>
            {navLinks.slice(0, 4).map((link, i) => (
              <div
                key={i}
                style={{
                  fontSize: '8px',
                  opacity: 0.9
                }}
              >
                {link.emoji}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hover Preview when minimized */}
      {!isExpanded && isHovered && (
        <div style={{
          position: 'absolute',
          top: '0',
          right: '60px',
          background: 'rgba(0,0,0,0.9)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          🚀 Click to expand navigation
        </div>
      )}

      {/* Expanded State */}
      {isExpanded && (
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          padding: '12px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minWidth: '200px',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {/* Header with close button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            fontWeight: 'bold',
            color: 'white',
            borderBottom: '1px solid rgba(255,255,255,0.3)',
            paddingBottom: '8px',
            marginBottom: '4px'
          }}>
            <span>🚀 Quick Navigation</span>
            <button
              onClick={toggleExpanded}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '2px 6px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
              }}
              title="Minimize"
            >
              ×
            </button>
          </div>
          
          {/* Navigation Links */}
          {navLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => router.push(link.path)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 12px',
                color: 'white',
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <span style={{ fontSize: '16px' }}>{link.emoji}</span>
              <span>{link.name.replace(link.emoji + ' ', '')}</span>
            </button>
          ))}
          
          {/* Session Info */}
          <div style={{
            fontSize: '10px',
            color: 'rgba(255,255,255,0.7)',
            marginTop: '8px',
            padding: '6px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            Session: <span style={{ fontFamily: 'monospace' }}>{testSessionId.slice(0, 25)}...</span>
          </div>

          {/* Quick Actions */}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginTop: '4px'
          }}>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                fontSize: '10px',
                padding: '4px 8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
              }}
              title="Clear localStorage and refresh"
            >
              🔄 Reset
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(testSessionId)}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                fontSize: '10px',
                padding: '4px 8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
              }}
              title="Copy session ID"
            >
              📋 Copy
            </button>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes slideIn {
          from { 
            opacity: 0; 
            transform: scale(0.9) translateX(20px); 
          }
          to { 
            opacity: 1; 
            transform: scale(1) translateX(0); 
          }
        }
      `}</style>
    </div>
  );
}
