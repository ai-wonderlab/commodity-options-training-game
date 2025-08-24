'use client';

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  FileText, 
  Users, 
  TrendingUp, 
  Target, 
  AlertTriangle,
  Database,
  Calendar,
  Filter,
  Check,
  Clock,
  BarChart3
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

interface ExportConfig {
  type: 'trades' | 'leaderboard' | 'risk' | 'performance' | 'positions' | 'breaches' | 'full-session';
  participantId?: string;
  dateFrom?: string;
  dateTo?: string;
  includeDetails?: boolean;
}

interface ExportOption {
  type: ExportConfig['type'];
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  instructorOnly?: boolean;
  supportsFiltering?: boolean;
  supportsDetails?: boolean;
}

interface Participant {
  id: string;
  display_name: string;
  seat_no: number;
  is_instructor: boolean;
}

interface ExportManagerProps {
  sessionId: string;
  sessionName: string;
  isInstructor: boolean;
  participantId?: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    type: 'trades',
    title: 'Trades Export',
    description: 'Όλες οι συναλλαγές με λεπτομέρειες εκτέλεσης',
    icon: FileText,
    supportsFiltering: true,
    supportsDetails: true
  },
  {
    type: 'leaderboard',
    title: 'Leaderboard Export',
    description: 'Κατάταξη με scores και performance metrics',
    icon: Users,
    supportsDetails: true
  },
  {
    type: 'risk',
    title: 'Risk Analysis Export',
    description: 'Greeks snapshots και risk metrics',
    icon: AlertTriangle,
    supportsFiltering: true
  },
  {
    type: 'performance',
    title: 'Performance Export',
    description: 'EOD snapshots και performance tracking',
    icon: TrendingUp,
    supportsFiltering: true
  },
  {
    type: 'positions',
    title: 'Positions Export',
    description: 'Ανοιχτές θέσεις και P&L breakdown',
    icon: Target
  },
  {
    type: 'breaches',
    title: 'Risk Breaches Export',
    description: 'Ιστορικό παραβάσεων risk limits',
    icon: BarChart3,
    supportsFiltering: true
  },
  {
    type: 'full-session',
    title: 'Complete Session Export',
    description: 'Πλήρης εξαγωγή όλων των δεδομένων',
    icon: Database,
    instructorOnly: true
  }
];

export default function ExportManager({
  sessionId,
  sessionName,
  isInstructor,
  participantId
}: ExportManagerProps) {
  const [selectedExport, setSelectedExport] = useState<ExportConfig>({
    type: 'trades',
    includeDetails: false
  });
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportHistory, setExportHistory] = useState<{[key: string]: Date}>({});
  const [showFilters, setShowFilters] = useState(false);

  // Load participants
  useEffect(() => {
    loadParticipants();
  }, [sessionId]);

  const loadParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('id, display_name, seat_no, is_instructor')
        .eq('session_id', sessionId)
        .order('seat_no');

      if (error) throw error;
      setParticipants(data || []);
    } catch (error: any) {
      console.error('Error loading participants:', error);
    }
  };

  // Execute export
  const executeExport = async () => {
    if (!selectedExport.type) return;

    setIsExporting(true);
    
    try {
      const response = await fetch('/api/functions/export-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          sessionId,
          exportType: selectedExport.type,
          participantId: selectedExport.participantId,
          dateFrom: selectedExport.dateFrom,
          dateTo: selectedExport.dateTo,
          includeDetails: selectedExport.includeDetails
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Αποτυχία εξαγωγής');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] || `${sessionName}-${selectedExport.type}-${new Date().toISOString().split('T')[0]}.csv`;

      // Create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Update export history
      setExportHistory(prev => ({
        ...prev,
        [selectedExport.type]: new Date()
      }));

      toast.success(`Εξαγωγή ${getExportOption(selectedExport.type)?.title} ολοκληρώθηκε`);
      
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || 'Σφάλμα κατά την εξαγωγή');
    } finally {
      setIsExporting(false);
    }
  };

  // Get export option details
  const getExportOption = (type: ExportConfig['type']) => {
    return EXPORT_OPTIONS.find(opt => opt.type === type);
  };

  // Update export config
  const updateConfig = (updates: Partial<ExportConfig>) => {
    setSelectedExport(prev => ({ ...prev, ...updates }));
  };

  // Get available export options (filter instructor-only)
  const availableOptions = EXPORT_OPTIONS.filter(option => 
    !option.instructorOnly || isInstructor
  );

  // Get selected participant name
  const getParticipantName = (id: string) => {
    const participant = participants.find(p => p.id === id);
    return participant ? `${participant.display_name} (#${participant.seat_no})` : 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Εξαγωγή Δεδομένων</h3>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Απόκρυψη' : 'Φίλτρα'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="text-center">
            <div className="text-sm text-gray-500">Συνεδρία</div>
            <div className="font-medium text-gray-900 dark:text-white">{sessionName}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">Συμμετέχοντες</div>
            <div className="font-medium text-gray-900 dark:text-white">{participants.length}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">Δικαιώματα</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {isInstructor ? 'Εκπαιδευτής' : 'Συμμετέχων'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">Διαθέσιμες Εξαγωγές</div>
            <div className="font-medium text-gray-900 dark:text-white">{availableOptions.length}</div>
          </div>
        </div>
      </div>

      {/* Export Type Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4">Επιλογή Εξαγωγής</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {availableOptions.map(option => {
            const Icon = option.icon;
            const isSelected = selectedExport.type === option.type;
            const lastExport = exportHistory[option.type];
            
            return (
              <div
                key={option.type}
                onClick={() => updateConfig({ type: option.type })}
                className={`cursor-pointer border rounded-lg p-4 transition-all hover:shadow-md ${
                  isSelected 
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    isSelected 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900 dark:text-white">
                      {option.title}
                    </h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {option.description}
                    </p>
                    
                    {lastExport && (
                      <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
                        <Check className="w-3 h-3" />
                        Εξήχθη: {lastExport.toLocaleString('el-GR')}
                      </div>
                    )}
                    
                    {option.instructorOnly && !isInstructor && (
                      <div className="text-xs text-yellow-600 mt-2">
                        Μόνο εκπαιδευτές
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters and Options */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
          <h4 className="font-medium text-gray-900 dark:text-white mb-4">Φίλτρα & Επιλογές</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Participant Filter */}
            {isInstructor && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Συμμετέχων (προαιρετικό)
                </label>
                <select
                  value={selectedExport.participantId || ''}
                  onChange={(e) => updateConfig({ participantId: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="">Όλοι οι συμμετέχοντες</option>
                  {participants.map(participant => (
                    <option key={participant.id} value={participant.id}>
                      {participant.display_name} (#{participant.seat_no})
                      {participant.is_instructor && ' - Εκπαιδευτής'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range Filters */}
            {getExportOption(selectedExport.type)?.supportsFiltering && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Από Ημερομηνία (προαιρετικό)
                  </label>
                  <input
                    type="datetime-local"
                    value={selectedExport.dateFrom || ''}
                    onChange={(e) => updateConfig({ dateFrom: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Μέχρι Ημερομηνία (προαιρετικό)
                  </label>
                  <input
                    type="datetime-local"
                    value={selectedExport.dateTo || ''}
                    onChange={(e) => updateConfig({ dateTo: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              </>
            )}

            {/* Include Details Option */}
            {getExportOption(selectedExport.type)?.supportsDetails && (
              <div className="md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedExport.includeDetails || false}
                    onChange={(e) => updateConfig({ includeDetails: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Συμπεριλάβε επιπλέον λεπτομέρειες
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Προσθέτει επιπλέον στήλες με αναλυτικές πληροφορίες
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4">Περίληψη Εξαγωγής</h4>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Τύπος:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {getExportOption(selectedExport.type)?.title}
            </span>
          </div>
          
          {selectedExport.participantId && (
            <div className="flex justify-between">
              <span className="text-gray-500">Συμμετέχων:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {getParticipantName(selectedExport.participantId)}
              </span>
            </div>
          )}
          
          {selectedExport.dateFrom && (
            <div className="flex justify-between">
              <span className="text-gray-500">Από:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {new Date(selectedExport.dateFrom).toLocaleString('el-GR')}
              </span>
            </div>
          )}
          
          {selectedExport.dateTo && (
            <div className="flex justify-between">
              <span className="text-gray-500">Μέχρι:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {new Date(selectedExport.dateTo).toLocaleString('el-GR')}
              </span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-gray-500">Λεπτομέρειες:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {selectedExport.includeDetails ? 'Ναι' : 'Όχι'}
            </span>
          </div>
        </div>
      </div>

      {/* Export Button */}
      <div className="text-center">
        <button
          onClick={executeExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
        >
          {isExporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Εξαγωγή σε εξέλιξη...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Εκκίνηση Εξαγωγής
            </>
          )}
        </button>
      </div>

      {/* Data Processing Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
              Πληροφορίες Εξαγωγής
            </h4>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <p>• Όλα τα δεδομένα εξάγονται σε μορφή CSV με UTF-8 encoding</p>
              <p>• Τα προσωπικά δεδομένα επεξεργάζονται σύμφωνα με τον GDPR</p>
              <p>• Η εξαγωγή περιλαμβάνει μόνο εκπαιδευτικά δεδομένα προσομοίωσης</p>
              <p>• Τα αρχεία δημιουργούνται σε real-time και δεν αποθηκεύονται στον server</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
