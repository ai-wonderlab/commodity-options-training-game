'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { Activity } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the code from URL
        const code = new URLSearchParams(window.location.search).get('code');
        
        if (code) {
          // Exchange code for session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) throw error;
          
          if (data.session) {
            toast.success('Successfully logged in!');
            
            // Check if user was trying to join a session
            const returnTo = sessionStorage.getItem('returnTo');
            if (returnTo) {
              sessionStorage.removeItem('returnTo');
              router.push(returnTo);
            } else {
              router.push('/');
            }
          }
        } else {
          // No code in URL, might be an error
          const error = new URLSearchParams(window.location.search).get('error');
          const errorDescription = new URLSearchParams(window.location.search).get('error_description');
          
          if (error) {
            throw new Error(errorDescription || error);
          }
        }
      } catch (error: any) {
        console.error('Auth callback error:', error);
        toast.error(error.message || 'Authentication failed');
        router.push('/');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
      <div className="text-center">
        <Activity className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
        <h2 className="text-h3 font-serif font-bold text-foreground mb-2">
          Completing Sign In...
        </h2>
        <p className="text-body text-muted-foreground">
          Please wait while we verify your credentials
        </p>
      </div>
    </div>
  );
}