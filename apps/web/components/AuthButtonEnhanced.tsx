'use client';

import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { 
  LogIn, 
  LogOut, 
  User as UserIcon, 
  ChevronDown,
  Shield,
  Chrome,
  Loader2
} from 'lucide-react';
import { cn, buttonStyles, cardStyles } from '../lib/utils';
import toast from 'react-hot-toast';

export default function AuthButtonEnhanced() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    // Check current session
    const checkUser = async () => {
      if (!isSupabaseConfigured()) {
        // Mock user for development
        setUser({
          id: 'mock-user',
          email: 'demo@example.com',
          user_metadata: { 
            full_name: 'Demo User',
            avatar_url: null
          }
        } as User);
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured()) {
      toast.error('Please configure Supabase first');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Google login error:', error);
      toast.error(error.message || 'Failed to login with Google');
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    if (!isSupabaseConfigured()) {
      toast.error('Please configure Supabase first');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'email profile',
        }
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Microsoft login error:', error);
      toast.error(error.message || 'Failed to login with Microsoft');
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    // For development/demo purposes
    toast.success('Using demo mode - no authentication required');
    setUser({
      id: 'demo-user',
      email: 'demo@example.com',
      user_metadata: { 
        full_name: 'Demo User',
        avatar_url: null
      }
    } as User);
    setShowLoginModal(false);
  };

  const handleLogout = async () => {
    if (!isSupabaseConfigured()) {
      setUser(null);
      toast.success('Logged out from demo mode');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast.success('Logged out successfully');
      setShowDropdown(false);
    } catch (error: any) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    } finally {
      setLoading(false);
    }
  };

  const getUserDisplayName = () => {
    if (!user) return '';
    return user.user_metadata?.full_name || 
           user.user_metadata?.name || 
           user.email?.split('@')[0] || 
           'User';
  };

  const getUserInitials = () => {
    const name = getUserDisplayName();
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className={cn(buttonStyles.base, buttonStyles.sizes.sm, "min-w-[100px]")}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <button
          onClick={() => setShowLoginModal(true)}
          className={cn(
            buttonStyles.base,
            buttonStyles.variants.default,
            buttonStyles.sizes.sm,
            "min-w-[100px]"
          )}
        >
          <LogIn className="h-4 w-4 mr-2" />
          Sign In
        </button>

        {/* Login Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className={cn(cardStyles.base, "w-full max-w-md animate-fade-in-down")}>
              <div className={cardStyles.header}>
                <h2 className="text-h3 font-serif font-bold text-foreground">
                  Sign In to Continue
                </h2>
                <p className="text-body text-muted-foreground mt-2">
                  Choose your authentication method
                </p>
              </div>

              <div className={cardStyles.content}>
                <div className="space-y-3">
                  {/* Google OAuth */}
                  <button
                    onClick={handleGoogleLogin}
                    disabled={!isSupabaseConfigured()}
                    className={cn(
                      buttonStyles.base,
                      "w-full justify-center bg-white hover:bg-gray-50 text-gray-900 border-gray-300",
                      "dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white dark:border-gray-600",
                      !isSupabaseConfigured() && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </button>

                  {/* Microsoft OAuth */}
                  <button
                    onClick={handleMicrosoftLogin}
                    disabled={!isSupabaseConfigured()}
                    className={cn(
                      buttonStyles.base,
                      "w-full justify-center bg-[#2F2F2F] hover:bg-[#1F1F1F] text-white border-[#2F2F2F]",
                      !isSupabaseConfigured() && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                      <path fill="#F25022" d="M11.4 11.4H0V0h11.4v11.4z"/>
                      <path fill="#7FBA00" d="M24 11.4H12.6V0H24v11.4z"/>
                      <path fill="#00A4EF" d="M11.4 24H0V12.6h11.4V24z"/>
                      <path fill="#FFB900" d="M24 24H12.6V12.6H24V24z"/>
                    </svg>
                    Continue with Microsoft
                  </button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>

                  {/* Demo Mode */}
                  <button
                    onClick={handleDemoLogin}
                    className={cn(
                      buttonStyles.base,
                      buttonStyles.variants.outline,
                      "w-full justify-center"
                    )}
                  >
                    <Shield className="h-5 w-5 mr-3" />
                    Continue in Demo Mode
                  </button>

                  {!isSupabaseConfigured() && (
                    <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                      <p className="text-xs text-warning text-center">
                        Supabase not configured. Use demo mode or follow setup guide.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-3 bg-muted/30 border-t border-border">
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={cn(
          buttonStyles.base,
          buttonStyles.variants.ghost,
          buttonStyles.sizes.sm,
          "min-w-[150px] justify-between"
        )}
      >
        <div className="flex items-center gap-2">
          {user.user_metadata?.avatar_url ? (
            <img 
              src={user.user_metadata.avatar_url} 
              alt="Avatar" 
              className="h-6 w-6 rounded-full"
            />
          ) : (
            <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              {getUserInitials()}
            </div>
          )}
          <span className="text-sm font-medium truncate max-w-[100px]">
            {getUserDisplayName()}
          </span>
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 transition-transform",
          showDropdown && "rotate-180"
        )} />
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className={cn(
          cardStyles.base,
          "absolute right-0 mt-2 w-64 shadow-hard z-50 animate-fade-in-down"
        )}>
          <div className="p-3 border-b border-border">
            <div className="text-sm font-medium text-foreground">
              {getUserDisplayName()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {user.email}
            </div>
          </div>

          <div className="p-2">
            <button
              onClick={() => {
                // Navigate to profile/settings
                setShowDropdown(false);
                toast('Profile settings coming soon!');
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm rounded-md",
                "hover:bg-muted transition-colors flex items-center gap-2"
              )}
            >
              <UserIcon className="h-4 w-4" />
              Profile Settings
            </button>

            <div className="my-2 border-t border-border"></div>

            <button
              onClick={handleLogout}
              className={cn(
                "w-full text-left px-3 py-2 text-sm rounded-md",
                "hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-2"
              )}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
