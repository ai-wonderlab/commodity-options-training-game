'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { 
  Users, 
  X, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { cn, buttonStyles, inputStyles, cardStyles } from '../lib/utils';
import toast from 'react-hot-toast';

interface SessionJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SessionJoinModal({ isOpen, onClose }: SessionJoinModalProps) {
  const router = useRouter();
  const [sessionCode, setSessionCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'code' | 'name'>('code');

  const handleJoinSession = async () => {
    if (!sessionCode.trim()) {
      toast.error('Please enter a session code');
      return;
    }

    if (step === 'code') {
      // Move to name step
      setStep('name');
      return;
    }

    if (!displayName.trim()) {
      toast.error('Please enter your display name');
      return;
    }

    setLoading(true);

    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user && isSupabaseConfigured()) {
        // Store return URL and redirect to auth
        sessionStorage.setItem('returnTo', `/session/${sessionCode.toUpperCase()}`);
        sessionStorage.setItem('pendingSessionCode', sessionCode.toUpperCase());
        sessionStorage.setItem('pendingDisplayName', displayName);
        
        toast('Please sign in to join the session');
        onClose();
        
        // Trigger login modal
        document.getElementById('auth-button')?.click();
        return;
      }

      // If not configured or in demo mode, use mock user ID
      const userId = user?.id || `demo-${Date.now()}`;

      // Call session-join API
      const response = await fetch('/api/functions/session-join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': user ? `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` : ''
        },
        body: JSON.stringify({
          sessionCode: sessionCode.toUpperCase(),
          displayName,
          ssoUserId: userId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join session');
      }

      toast.success(`Joined session as ${displayName}!`);
      onClose();
      
      // Navigate to session page
      router.push(`/session/${data.sessionId}`);

    } catch (error: any) {
      console.error('Join session error:', error);
      toast.error(error.message || 'Failed to join session');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJoinSession();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={cn(cardStyles.base, "w-full max-w-md animate-fade-in-down")}>
        <div className={cardStyles.header}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-h3 font-serif font-bold text-foreground">
                Join Trading Session
              </h2>
              <p className="text-body text-muted-foreground mt-1">
                {step === 'code' ? 'Enter the session code from your instructor' : 'Choose your display name'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className={cardStyles.content}>
          <div className="space-y-4">
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className={cn(
                "h-2 w-2 rounded-full",
                step === 'code' ? "bg-primary" : "bg-success"
              )} />
              <div className={cn(
                "h-2 w-2 rounded-full",
                step === 'name' ? "bg-primary" : "bg-muted"
              )} />
            </div>

            {step === 'code' ? (
              <>
                {/* Session Code Input */}
                <div>
                  <label className="text-caption text-muted-foreground uppercase tracking-wide mb-2 block">
                    Session Code
                  </label>
                  <input
                    type="text"
                    value={sessionCode}
                    onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                    onKeyPress={handleKeyPress}
                    placeholder="ENTER CODE"
                    maxLength={12}
                    className={cn(
                      inputStyles.base,
                      "text-center text-2xl font-mono uppercase tracking-wider"
                    )}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Ask your instructor for the 8-character session code
                  </p>
                </div>

                {/* Example */}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-info mt-0.5" />
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium mb-1">Example codes:</p>
                      <p>DEMO2024, TRAIN001, BRN12345</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Display Name Input */}
                <div>
                  <label className="text-caption text-muted-foreground uppercase tracking-wide mb-2 block">
                    Your Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter your name"
                    maxLength={30}
                    className={cn(inputStyles.base, "text-lg")}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    This name will be shown on the leaderboard
                  </p>
                </div>

                {/* Session Info */}
                <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <div className="text-sm">
                      <span className="text-success font-medium">Session found!</span>
                      <span className="text-muted-foreground ml-2">Code: {sessionCode}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {step === 'name' && (
                <button
                  onClick={() => setStep('code')}
                  className={cn(
                    buttonStyles.base,
                    buttonStyles.variants.outline,
                    buttonStyles.sizes.lg,
                    "flex-1"
                  )}
                  disabled={loading}
                >
                  Back
                </button>
              )}
              
              <button
                onClick={handleJoinSession}
                disabled={loading || (!sessionCode && step === 'code') || (!displayName && step === 'name')}
                className={cn(
                  buttonStyles.base,
                  buttonStyles.variants.default,
                  buttonStyles.sizes.lg,
                  "flex-1 font-semibold"
                )}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : (
                  <>
                    {step === 'code' ? (
                      <>
                        Next
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    ) : (
                      <>
                        <Users className="h-5 w-5 mr-2" />
                        Join Session
                      </>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
