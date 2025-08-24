'use client';

import React, { useState } from 'react';
import { X, Info, Shield, Globe, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ComplianceBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isVisible) return null;

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50",
      "bg-gradient-to-r from-primary/95 to-primary backdrop-blur-md",
      "border-t border-primary-foreground/10",
      "transition-all duration-300 animate-slide-in-from-bottom"
    )}>
      <div className="max-w-screen-2xl mx-auto">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-primary-foreground">
              {/* Main compliance badges */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span className="text-xs font-medium">Education Only</span>
                </div>
                <div className="h-4 w-px bg-primary-foreground/20" />
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-medium">15-min Delayed</span>
                </div>
                <div className="h-4 w-px bg-primary-foreground/20" />
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span className="text-xs font-medium">EU Region Only</span>
                </div>
              </div>

              {/* Additional info button */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 px-3 py-1 rounded-md bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
              >
                <Info className="h-3 w-3" />
                <span className="text-xs">More Info</span>
              </button>
            </div>

            {/* Close button */}
            <button
              onClick={() => setIsVisible(false)}
              className="p-1 rounded-md hover:bg-primary-foreground/10 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4 text-primary-foreground" />
            </button>
          </div>

          {/* Expanded information */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-primary-foreground/10 animate-fade-in-down">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-primary-foreground/90">
                <div>
                  <h4 className="text-xs font-bold mb-1">Educational Purpose</h4>
                  <p className="text-xs leading-relaxed">
                    This platform is for training purposes only. No real money or actual trading involved.
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-bold mb-1">Market Data</h4>
                  <p className="text-xs leading-relaxed">
                    Prices are delayed by 15 minutes. Based on ICE Brent (BRN) futures and EU-style options (BUL).
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-bold mb-1">Compliance</h4>
                  <p className="text-xs leading-relaxed">
                    GDPR compliant. Data stored in EU region. Session data retained for 30 days only.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}