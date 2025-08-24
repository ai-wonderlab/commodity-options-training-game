'use client';

import React, { useState, useEffect } from 'react';
import { 
  Info, 
  AlertTriangle, 
  Shield, 
  Clock, 
  X, 
  ExternalLink,
  Eye,
  Database,
  MapPin,
  BookOpen,
  CheckCircle
} from 'lucide-react';

interface ComplianceBannerProps {
  type: 'educational' | 'gdpr' | 'data-delay' | 'risk-warning' | 'eu-hosting' | 'cookie-consent';
  position?: 'top' | 'bottom' | 'inline';
  dismissible?: boolean;
  persistent?: boolean;
  onDismiss?: () => void;
  onAccept?: () => void;
  showDetails?: boolean;
}

const COMPLIANCE_CONTENT = {
  educational: {
    icon: BookOpen,
    title: 'Μόνο για Εκπαιδευτικούς Σκοπούς',
    message: 'Αυτή η πλατφόρμα προσφέρεται αποκλειστικά για εκπαιδευτικούς σκοπούς και δεν αποτελεί επενδυτική συμβουλή.',
    details: 'Όλες οι συναλλαγές είναι προσομοιώσεις. Δεν εμπλέκονται πραγματικά χρήματα ή χρηματοπιστωτικά προϊόντα. Τα αποτελέσματα δεν αντανακλούν πραγματικές συνθήκες αγοράς.',
    color: 'blue',
    severity: 'info'
  },
  gdpr: {
    icon: Shield,
    title: 'Προστασία Δεδομένων (GDPR)',
    message: 'Τα δεδομένα σας επεξεργάζονται σύμφωνα με τον GDPR και αποθηκεύονται σε servers της ΕΕ.',
    details: 'Συλλέγουμε και επεξεργαζόμαστε μόνο τα απολύτως απαραίτητα δεδομένα για την εκπαιδευτική εμπειρία. Έχετε δικαίωμα πρόσβασης, διόρθωσης και διαγραφής των δεδομένων σας.',
    color: 'green',
    severity: 'info'
  },
  'data-delay': {
    icon: Clock,
    title: 'Καθυστερημένα Δεδομένα',
    message: 'Όλα τα δεδομένα αγοράς είναι καθυστερημένα κατά 15 λεπτά και προορίζονται μόνο για εκπαίδευση.',
    details: 'Τα δεδομένα τιμών και μεταβλητότητας δεν είναι real-time και δεν πρέπει να χρησιμοποιηθούν για πραγματικές επενδυτικές αποφάσεις.',
    color: 'yellow',
    severity: 'warning'
  },
  'risk-warning': {
    icon: AlertTriangle,
    title: 'Προειδοποίηση Κινδύνου',
    message: 'Τα παράγωγα χρηματοπιστωτικά προϊόντα ενέχουν υψηλό κίνδυνο και δεν είναι κατάλληλα για όλους.',
    details: 'Η εμπορία options και futures μπορεί να οδηγήσει σε σημαντικές απώλειες. Αυτή η πλατφόρμα είναι μόνο για εκπαιδευτική εξάσκηση.',
    color: 'red',
    severity: 'critical'
  },
  'eu-hosting': {
    icon: MapPin,
    title: 'EU Data Hosting',
    message: 'Όλα τα δεδομένα αποθηκεύονται και επεξεργάζονται εντός της Ευρωπαϊκής Ένωσης.',
    details: 'Η πλατφόρμα χρησιμοποιεί Supabase EU region για πλήρη συμμόρφωση με τους κανονισμούς της ΕΕ περί προστασίας δεδομένων.',
    color: 'blue',
    severity: 'info'
  },
  'cookie-consent': {
    icon: Eye,
    title: 'Χρήση Cookies',
    message: 'Χρησιμοποιούμε απολύτως απαραίτητα cookies για τη λειτουργία της πλατφόρμας.',
    details: 'Δεν χρησιμοποιούνται cookies marketing ή tracking. Μόνο τεχνικά cookies για authentication και session management.',
    color: 'gray',
    severity: 'info'
  }
};

const SEVERITY_STYLES = {
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
  warning: 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200',
  critical: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200'
};

export default function ComplianceBanner({
  type,
  position = 'top',
  dismissible = true,
  persistent = false,
  onDismiss,
  onAccept,
  showDetails = false
}: ComplianceBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [showFullDetails, setShowFullDetails] = useState(showDetails);
  const [hasAccepted, setHasAccepted] = useState(false);
  
  const content = COMPLIANCE_CONTENT[type];
  const Icon = content.icon;
  
  // Check if user has already dismissed this banner
  useEffect(() => {
    if (!persistent) {
      const dismissed = localStorage.getItem(`compliance-${type}-dismissed`);
      const accepted = localStorage.getItem(`compliance-${type}-accepted`);
      
      if (dismissed === 'true' || accepted === 'true') {
        setIsVisible(false);
        setHasAccepted(accepted === 'true');
      }
    }
  }, [type, persistent]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (!persistent) {
      localStorage.setItem(`compliance-${type}-dismissed`, 'true');
    }
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleAccept = () => {
    setHasAccepted(true);
    setIsVisible(false);
    if (!persistent) {
      localStorage.setItem(`compliance-${type}-accepted`, 'true');
    }
    if (onAccept) {
      onAccept();
    }
  };

  if (!isVisible) {
    return null;
  }

  const positionClasses = {
    top: 'fixed top-0 left-0 right-0 z-50',
    bottom: 'fixed bottom-0 left-0 right-0 z-50',
    inline: 'relative'
  };

  return (
    <div className={`${positionClasses[position]} ${SEVERITY_STYLES[content.severity]} border-l-4 transition-all duration-300`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            <Icon className="w-5 h-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-medium">
                  {content.title}
                </h4>
                <p className="text-sm mt-1 opacity-90">
                  {content.message}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-4">
                {content.details && (
                  <button
                    onClick={() => setShowFullDetails(!showFullDetails)}
                    className="text-xs underline opacity-75 hover:opacity-100"
                  >
                    {showFullDetails ? 'Λιγότερα' : 'Περισσότερα'}
                  </button>
                )}

                {type === 'cookie-consent' && !hasAccepted && (
                  <button
                    onClick={handleAccept}
                    className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Αποδοχή
                  </button>
                )}

                {dismissible && (
                  <button
                    onClick={handleDismiss}
                    className="opacity-75 hover:opacity-100"
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Detailed information */}
            {showFullDetails && content.details && (
              <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                <p className="text-sm opacity-80 leading-relaxed">
                  {content.details}
                </p>
                
                {type === 'gdpr' && (
                  <div className="mt-2 flex flex-wrap gap-4 text-xs">
                    <a href="#" className="flex items-center gap-1 underline opacity-75 hover:opacity-100">
                      <ExternalLink className="w-3 h-3" />
                      Πολιτική Απορρήτου
                    </a>
                    <a href="#" className="flex items-center gap-1 underline opacity-75 hover:opacity-100">
                      <Shield className="w-3 h-3" />
                      Δικαιώματά σας
                    </a>
                  </div>
                )}

                {type === 'risk-warning' && (
                  <div className="mt-2">
                    <p className="text-xs font-medium opacity-90">
                      Προσοχή: Αυτό είναι εκπαιδευτικό περιβάλλον. 
                      Δεν εμπλέκονται πραγματικά χρήματα.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Sticky compliance footer component
export function ComplianceFooter() {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-gray-800 text-gray-300 text-xs py-2 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              Εκπαιδευτικό Περιβάλλον
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Δεδομένα καθυστερημένα 15min
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              EU Servers
            </span>
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              GDPR Compliant
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="underline opacity-75 hover:opacity-100"
            >
              Πληροφορίες
            </button>
          </div>
        </div>
        
        {showDetails && (
          <div className="mt-2 pt-2 border-t border-gray-700 text-center opacity-75">
            <p>
              Αποκλειστικά για εκπαιδευτικούς σκοπούς • Δεν αποτελεί επενδυτική συμβουλή • 
              Προσομοίωση χρηματιστηριακών συναλλαγών • Δεδομένα EU (GDPR)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Compliance provider context
export const ComplianceContext = React.createContext<{
  hasAcceptedRiskWarning: boolean;
  hasAcceptedCookies: boolean;
  setAcceptedRiskWarning: (accepted: boolean) => void;
  setAcceptedCookies: (accepted: boolean) => void;
}>({
  hasAcceptedRiskWarning: false,
  hasAcceptedCookies: false,
  setAcceptedRiskWarning: () => {},
  setAcceptedCookies: () => {}
});

export function ComplianceProvider({ children }: { children: React.ReactNode }) {
  const [hasAcceptedRiskWarning, setHasAcceptedRiskWarning] = useState(false);
  const [hasAcceptedCookies, setHasAcceptedCookies] = useState(false);

  useEffect(() => {
    // Check localStorage for previous acceptances
    const riskAccepted = localStorage.getItem('compliance-risk-warning-accepted') === 'true';
    const cookiesAccepted = localStorage.getItem('compliance-cookie-consent-accepted') === 'true';
    
    setHasAcceptedRiskWarning(riskAccepted);
    setHasAcceptedCookies(cookiesAccepted);
  }, []);

  const setAcceptedRiskWarning = (accepted: boolean) => {
    setHasAcceptedRiskWarning(accepted);
    localStorage.setItem('compliance-risk-warning-accepted', accepted.toString());
  };

  const setAcceptedCookies = (accepted: boolean) => {
    setHasAcceptedCookies(accepted);
    localStorage.setItem('compliance-cookie-consent-accepted', accepted.toString());
  };

  return (
    <ComplianceContext.Provider value={{
      hasAcceptedRiskWarning,
      hasAcceptedCookies,
      setAcceptedRiskWarning,
      setAcceptedCookies
    }}>
      {children}
    </ComplianceContext.Provider>
  );
}

// Hook for using compliance context
export function useCompliance() {
  const context = React.useContext(ComplianceContext);
  if (!context) {
    throw new Error('useCompliance must be used within a ComplianceProvider');
  }
  return context;
}

// Data processing notice component (for forms)
export function DataProcessingNotice({ 
  compact = false 
}: { 
  compact?: boolean 
}) {
  if (compact) {
    return (
      <div className="text-xs text-gray-500 mt-2">
        <Shield className="w-3 h-3 inline mr-1" />
        Τα δεδομένα επεξεργάζονται σύμφωνα με τον GDPR (ΕΕ)
      </div>
    );
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
      <div className="flex items-start gap-2">
        <Shield className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="font-medium text-blue-900 dark:text-blue-200">
            Προστασία Προσωπικών Δεδομένων
          </h4>
          <p className="text-blue-700 dark:text-blue-300 mt-1">
            Τα στοιχεία σας επεξεργάζονται μόνο για εκπαιδευτικούς σκοπούς και αποθηκεύονται 
            ασφαλώς σε servers της ΕΕ σύμφωνα με τον GDPR.
          </p>
        </div>
      </div>
    </div>
  );
}

// Educational disclaimer for market data displays
export function MarketDataDisclaimer({ 
  inline = true 
}: { 
  inline?: boolean 
}) {
  if (inline) {
    return (
      <div className="text-xs text-gray-400 text-center py-1 border-t border-gray-200 dark:border-gray-700">
        <Clock className="w-3 h-3 inline mr-1" />
        Δεδομένα καθυστερημένα 15min • Εκπαιδευτικοί σκοποί • Όχι επενδυτική συμβουλή
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
        <div className="text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Εκπαιδευτική Προσομοίωση:</strong> Όλα τα δεδομένα είναι καθυστερημένα και 
          προορίζονται μόνο για εκπαιδευτικούς σκοπούς. Δεν αποτελούν επενδυτική συμβουλή.
        </div>
      </div>
    </div>
  );
}
