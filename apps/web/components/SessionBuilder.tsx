'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import { 
  Settings, 
  Users, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Calendar,
  Database,
  Award,
  Save,
  Play,
  Template,
  Info,
  ChevronRight
} from 'lucide-react';

interface SessionTemplate {
  id: string;
  name: string;
  description: string;
  template_config: any;
}

interface SessionConfig {
  // Basic settings
  sessionName: string;
  description: string;
  maxParticipants: number;
  durationMinutes: number;
  bankroll: number;
  timezone: string;
  
  // Mode & data
  mode: 'live' | 'replay';
  dataProvider: 'mock' | 'refinitiv' | 'ice';
  region: 'eu' | 'us';
  baseVolatility: number;
  
  // Replay settings
  replayDay: string;
  replaySpeed: number;
  replayStartTime: string;
  replayEndTime: string;
  
  // Risk limits
  deltaCap: number;
  gammaCap: number;
  vegaCap: number;
  thetaCap: number;
  varLimit: number;
  allowBreachTrading: boolean;
  
  // Scoring weights  
  breachPenaltyWeight: number;
  varPenaltyWeight: number;
  drawdownPenaltyWeight: number;
  feeWeight: number;
  scoringMode: 'training' | 'competition';
  
  // Fee structure
  exchangeFee: number;
  clearingFee: number;
  commission: number;
  regulatoryFee: number;
  
  // Spreads
  futuresSpread: number;
  optionsATMSpread: number;
  optionsOTMSpread: number;
  
  // Instruments
  availableInstruments: string[];
  
  // Multi-day
  isMultiDay: boolean;
  tradingDays: number;
}

const DEFAULT_CONFIG: SessionConfig = {
  sessionName: '',
  description: '',
  maxParticipants: 25,
  durationMinutes: 60,
  bankroll: 1000000,
  timezone: 'Europe/Athens',
  mode: 'live',
  dataProvider: 'mock',
  region: 'eu',
  baseVolatility: 0.25,
  replayDay: new Date().toISOString().split('T')[0],
  replaySpeed: 1,
  replayStartTime: '09:30',
  replayEndTime: '17:00',
  deltaCap: 10000,
  gammaCap: 1000,
  vegaCap: 50000,
  thetaCap: 10000,
  varLimit: 100000,
  allowBreachTrading: true,
  breachPenaltyWeight: 10,
  varPenaltyWeight: 5,
  drawdownPenaltyWeight: 2,
  feeWeight: 1,
  scoringMode: 'training',
  exchangeFee: 0.50,
  clearingFee: 0.25,
  commission: 1.00,
  regulatoryFee: 0.00002,
  futuresSpread: 2,
  optionsATMSpread: 5,
  optionsOTMSpread: 10,
  availableInstruments: ['BRN', 'BUL-1M', 'BUL-2M', 'BUL-3M'],
  isMultiDay: false,
  tradingDays: 1
};

interface SessionBuilderProps {
  onSessionCreated: (sessionId: string) => void;
  onCancel: () => void;
}

export default function SessionBuilder({ onSessionCreated, onCancel }: SessionBuilderProps) {
  const [config, setConfig] = useState<SessionConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('session_templates')
        .select('*')
        .eq('is_public', true)
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error loading templates:', error);
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const templateConfig = template.template_config;
    setConfig(prev => ({
      ...prev,
      ...templateConfig,
      sessionName: prev.sessionName || template.name,
      description: prev.description || template.description
    }));
    
    toast.success(`Template "${template.name}" εφαρμόστηκε`);
  };

  const createSession = async (startImmediately: boolean = false) => {
    if (!config.sessionName.trim()) {
      toast.error('Εισάγετε όνομα συνεδρίας');
      return;
    }

    if (config.mode === 'replay' && !config.replayDay) {
      toast.error('Επιλέξτε ημερομηνία replay');
      return;
    }

    setSaving(true);
    try {
      const sessionData = {
        session_name: config.sessionName,
        description: config.description,
        mode: config.mode,
        bankroll: config.bankroll,
        max_participants: config.maxParticipants,
        duration_minutes: config.durationMinutes,
        timezone: config.timezone,
        status: startImmediately ? 'waiting' : 'setup',
        is_multi_day: config.isMultiDay,
        trading_days: config.tradingDays,
        
        // JSON configurations
        data_config: {
          provider: config.dataProvider,
          region: config.region,
          base_volatility: config.baseVolatility,
          symbols: ['BRN'],
          price_volatility: 0.02,
          iv_shock_size: 0.05
        },
        
        risk_config: {
          delta_cap: config.deltaCap,
          gamma_cap: config.gammaCap,
          vega_cap: config.vegaCap,
          theta_cap: config.thetaCap,
          var_limit: config.varLimit,
          allow_breach_trading: config.allowBreachTrading
        },
        
        scoring_weights: {
          breach_penalty_weight: config.breachPenaltyWeight,
          var_penalty_weight: config.varPenaltyWeight,
          drawdown_penalty_weight: config.drawdownPenaltyWeight,
          fee_weight: config.feeWeight,
          mode: config.scoringMode
        },
        
        fee_config: {
          exchange_fee: config.exchangeFee,
          clearing_fee: config.clearingFee,
          commission: config.commission,
          regulatory_fee: config.regulatoryFee,
          min_fee: 2.00,
          max_fee: 100.00
        },
        
        spread_config: {
          futures: {
            default: config.futuresSpread,
            front_month: config.futuresSpread * 0.75,
            back_months: config.futuresSpread * 1.5
          },
          options: {
            atm: config.optionsATMSpread,
            otm: config.optionsOTMSpread,
            deep: config.optionsOTMSpread * 2,
            near_expiry: 1.5
          }
        },
        
        replay_config: config.mode === 'replay' ? {
          replay_day: config.replayDay,
          replay_speed: config.replaySpeed,
          start_time: config.replayStartTime,
          end_time: config.replayEndTime
        } : {},
        
        available_instruments: config.availableInstruments,
        market_hours: {
          start: config.replayStartTime,
          end: config.replayEndTime
        }
      };

      const response = await fetch('/api/functions/session-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify(sessionData),
      });

      if (!response.ok) {
        throw new Error('Αποτυχία δημιουργίας συνεδρίας');
      }

      const result = await response.json();
      toast.success(
        startImmediately 
          ? 'Συνεδρία δημιουργήθηκε και είναι έτοιμη για συμμετοχή!'
          : 'Συνεδρία δημιουργήθηκε επιτυχώς!'
      );
      
      onSessionCreated(result.sessionId);
    } catch (error: any) {
      console.error('Session creation error:', error);
      toast.error(error.message || 'Σφάλμα κατά τη δημιουργία συνεδρίας');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Βασικά', icon: Settings },
    { id: 'risk', label: 'Ρίσκο', icon: AlertTriangle },
    { id: 'scoring', label: 'Βαθμολογία', icon: Award },
    { id: 'trading', label: 'Trading', icon: TrendingUp },
    { id: 'data', label: 'Δεδομένα', icon: Database }
  ];

  return (
    <div className="max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Δημιουργία Νέας Συνεδρίας
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Διαμορφώστε όλες τις παραμέτρους για τη νέα συνεδρία trading
            </p>
          </div>
        </div>
      </div>

      {/* Templates Section */}
      {templates.length > 0 && (
        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border-b">
          <div className="flex items-center gap-3 mb-3">
            <Template className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Γρήγορη Εκκίνηση με Template
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {templates.map(template => (
              <button
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template.id);
                  applyTemplate(template.id);
                }}
                className={`p-3 rounded-lg border text-left transition-all ${
                  selectedTemplate === template.id
                    ? 'border-blue-500 bg-blue-100 dark:bg-blue-800/50'
                    : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                }`}
              >
                <div className="font-medium text-sm text-gray-900 dark:text-white">
                  {template.name}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {template.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex">
        {/* Tabs Sidebar */}
        <div className="w-64 bg-gray-50 dark:bg-gray-900 p-4">
          <nav className="space-y-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                  <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${
                    activeTab === tab.id ? 'rotate-90' : ''
                  }`} />
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6">
          {/* Basic Settings Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Όνομα Συνεδρίας *
                  </label>
                  <input
                    type="text"
                    value={config.sessionName}
                    onChange={(e) => setConfig(prev => ({ ...prev, sessionName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    placeholder="π.χ. Options Training - Αρχάριοι"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Μέγιστοι Συμμετέχοντες
                  </label>
                  <input
                    type="number"
                    value={config.maxParticipants}
                    onChange={(e) => setConfig(prev => ({ ...prev, maxParticipants: parseInt(e.target.value) || 25 }))}
                    min="2"
                    max="50"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Διάρκεια (λεπτά)
                  </label>
                  <select
                    value={config.durationMinutes}
                    onChange={(e) => setConfig(prev => ({ ...prev, durationMinutes: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value={30}>30 λεπτά</option>
                    <option value={45}>45 λεπτά</option>
                    <option value={60}>1 ώρα</option>
                    <option value={90}>1.5 ώρες</option>
                    <option value={120}>2 ώρες</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Αρχικό Κεφάλαιο ($)
                  </label>
                  <select
                    value={config.bankroll}
                    onChange={(e) => setConfig(prev => ({ ...prev, bankroll: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value={500000}>$500,000</option>
                    <option value={1000000}>$1,000,000</option>
                    <option value={2000000}>$2,000,000</option>
                    <option value={5000000}>$5,000,000</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Περιγραφή
                </label>
                <textarea
                  value={config.description}
                  onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Περιγραφή της συνεδρίας (προαιρετική)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Λειτουργία
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, mode: 'live' }))}
                      className={`py-2 px-4 rounded-lg border font-medium ${
                        config.mode === 'live'
                          ? 'border-blue-500 bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:text-gray-300'
                      }`}
                    >
                      Live Data
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, mode: 'replay' }))}
                      className={`py-2 px-4 rounded-lg border font-medium ${
                        config.mode === 'replay'
                          ? 'border-blue-500 bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:text-gray-300'
                      }`}
                    >
                      Historical Replay
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id="multiDay"
                      checked={config.isMultiDay}
                      onChange={(e) => setConfig(prev => ({ ...prev, isMultiDay: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="multiDay" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Πολυήμερη Συνεδρία
                    </label>
                  </div>
                  {config.isMultiDay && (
                    <input
                      type="number"
                      value={config.tradingDays}
                      onChange={(e) => setConfig(prev => ({ ...prev, tradingDays: parseInt(e.target.value) || 1 }))}
                      min="2"
                      max="5"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                      placeholder="Αριθμός ημερών"
                    />
                  )}
                </div>
              </div>

              {config.mode === 'replay' && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    Ρυθμίσεις Historical Replay
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Ημερομηνία
                      </label>
                      <input
                        type="date"
                        value={config.replayDay}
                        onChange={(e) => setConfig(prev => ({ ...prev, replayDay: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Ταχύτητα
                      </label>
                      <select
                        value={config.replaySpeed}
                        onChange={(e) => setConfig(prev => ({ ...prev, replaySpeed: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                      >
                        <option value={1}>1x (Real-time)</option>
                        <option value={2}>2x</option>
                        <option value={4}>4x</option>
                        <option value={8}>8x</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Έναρξη
                        </label>
                        <input
                          type="time"
                          value={config.replayStartTime}
                          onChange={(e) => setConfig(prev => ({ ...prev, replayStartTime: e.target.value }))}
                          className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Λήξη
                        </label>
                        <input
                          type="time"
                          value={config.replayEndTime}
                          onChange={(e) => setConfig(prev => ({ ...prev, replayEndTime: e.target.value }))}
                          className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Risk Settings Tab */}
          {activeTab === 'risk' && (
            <div className="space-y-6">
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h3 className="font-semibold text-red-900 dark:text-red-200">
                    Όρια Κινδύνου (Risk Limits)
                  </h3>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                  Ορίστε τα μέγιστα όρια για κάθε Greek. Οι παραβάσεις επιφέρουν ποινές στη βαθμολογία.
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Delta Cap
                    </label>
                    <input
                      type="number"
                      value={config.deltaCap}
                      onChange={(e) => setConfig(prev => ({ ...prev, deltaCap: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Gamma Cap
                    </label>
                    <input
                      type="number"
                      value={config.gammaCap}
                      onChange={(e) => setConfig(prev => ({ ...prev, gammaCap: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Vega Cap
                    </label>
                    <input
                      type="number"
                      value={config.vegaCap}
                      onChange={(e) => setConfig(prev => ({ ...prev, vegaCap: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Theta Cap
                    </label>
                    <input
                      type="number"
                      value={config.thetaCap}
                      onChange={(e) => setConfig(prev => ({ ...prev, thetaCap: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-orange-900 dark:text-orange-200 mb-3">
                  VaR Limit
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      VaR Limit ($)
                    </label>
                    <input
                      type="number"
                      value={config.varLimit}
                      onChange={(e) => setConfig(prev => ({ ...prev, varLimit: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-1">95% Value at Risk limit</p>
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={config.allowBreachTrading}
                        onChange={(e) => setConfig(prev => ({ ...prev, allowBreachTrading: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Επιτρέπεται trading με παραβάσεις
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scoring Tab */}
          {activeTab === 'scoring' && (
            <div className="space-y-6">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 dark:text-green-200 mb-3">
                  Λειτουργία Βαθμολογίας
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, scoringMode: 'training' }))}
                    className={`p-3 rounded-lg border text-left ${
                      config.scoringMode === 'training'
                        ? 'border-green-500 bg-green-100 dark:bg-green-800'
                        : 'border-gray-300 hover:bg-green-50'
                    }`}
                  >
                    <div className="font-medium">Training</div>
                    <div className="text-sm text-gray-600">Μικρότερες ποινές για μάθηση</div>
                  </button>
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, scoringMode: 'competition' }))}
                    className={`p-3 rounded-lg border text-left ${
                      config.scoringMode === 'competition'
                        ? 'border-green-500 bg-green-100 dark:bg-green-800'
                        : 'border-gray-300 hover:bg-green-50'
                    }`}
                  >
                    <div className="font-medium">Competition</div>
                    <div className="text-sm text-gray-600">Αυστηρές ποινές για διαγωνισμούς</div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ποινή Παραβάσεων
                  </label>
                  <input
                    type="number"
                    value={config.breachPenaltyWeight}
                    onChange={(e) => setConfig(prev => ({ ...prev, breachPenaltyWeight: parseFloat(e.target.value) || 0 }))}
                    step="0.5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <p className="text-xs text-gray-500 mt-1">Βάρος για παραβάσεις Greeks</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ποινή VaR
                  </label>
                  <input
                    type="number"
                    value={config.varPenaltyWeight}
                    onChange={(e) => setConfig(prev => ({ ...prev, varPenaltyWeight: parseFloat(e.target.value) || 0 }))}
                    step="0.5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <p className="text-xs text-gray-500 mt-1">Βάρος για υπέρβαση VaR</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ποινή Drawdown
                  </label>
                  <input
                    type="number"
                    value={config.drawdownPenaltyWeight}
                    onChange={(e) => setConfig(prev => ({ ...prev, drawdownPenaltyWeight: parseFloat(e.target.value) || 0 }))}
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <p className="text-xs text-gray-500 mt-1">Βάρος για max drawdown</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Κόστος Συναλλαγών
                  </label>
                  <input
                    type="number"
                    value={config.feeWeight}
                    onChange={(e) => setConfig(prev => ({ ...prev, feeWeight: parseFloat(e.target.value) || 0 }))}
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <p className="text-xs text-gray-500 mt-1">Βάρος για fees</p>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                  Formula Βαθμολογίας
                </h4>
                <code className="text-sm text-blue-800 dark:text-blue-300">
                  Score = Realized P&L - (α × breach_time + β × var_excess + γ × max_drawdown + δ × fees)
                </code>
              </div>
            </div>
          )}

          {/* Trading Tab */}
          {activeTab === 'trading' && (
            <div className="space-y-6">
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-3">
                  Δομή Εξόδων (Fee Structure)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Exchange Fee ($)
                    </label>
                    <input
                      type="number"
                      value={config.exchangeFee}
                      onChange={(e) => setConfig(prev => ({ ...prev, exchangeFee: parseFloat(e.target.value) || 0 }))}
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Clearing Fee ($)
                    </label>
                    <input
                      type="number"
                      value={config.clearingFee}
                      onChange={(e) => setConfig(prev => ({ ...prev, clearingFee: parseFloat(e.target.value) || 0 }))}
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Commission ($)
                    </label>
                    <input
                      type="number"
                      value={config.commission}
                      onChange={(e) => setConfig(prev => ({ ...prev, commission: parseFloat(e.target.value) || 0 }))}
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Regulatory (%)
                    </label>
                    <input
                      type="number"
                      value={config.regulatoryFee * 10000}
                      onChange={(e) => setConfig(prev => ({ ...prev, regulatoryFee: (parseFloat(e.target.value) || 0) / 10000 }))}
                      step="0.1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-1">σε basis points</p>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-3">
                  Bid-Ask Spreads (basis points)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Futures Spread
                    </label>
                    <input
                      type="number"
                      value={config.futuresSpread}
                      onChange={(e) => setConfig(prev => ({ ...prev, futuresSpread: parseFloat(e.target.value) || 0 }))}
                      step="0.5"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Options ATM
                    </label>
                    <input
                      type="number"
                      value={config.optionsATMSpread}
                      onChange={(e) => setConfig(prev => ({ ...prev, optionsATMSpread: parseFloat(e.target.value) || 0 }))}
                      step="0.5"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Options OTM
                    </label>
                    <input
                      type="number"
                      value={config.optionsOTMSpread}
                      onChange={(e) => setConfig(prev => ({ ...prev, optionsOTMSpread: parseFloat(e.target.value) || 0 }))}
                      step="0.5"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Διαθέσιμα Προϊόντα
                </h3>
                <div className="space-y-2">
                  {['BRN', 'BUL-1M', 'BUL-2M', 'BUL-3M', 'BUL-6M'].map(instrument => (
                    <label key={instrument} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={config.availableInstruments.includes(instrument)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setConfig(prev => ({ 
                              ...prev, 
                              availableInstruments: [...prev.availableInstruments, instrument] 
                            }));
                          } else {
                            setConfig(prev => ({ 
                              ...prev, 
                              availableInstruments: prev.availableInstruments.filter(i => i !== instrument) 
                            }));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {instrument}
                        {instrument === 'BRN' && ' (Futures)'}
                        {instrument.startsWith('BUL') && ' (Options)'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Data Tab */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-3">
                  Πάροχος Δεδομένων
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'mock', label: 'Mock Data', desc: 'Προσομοιωμένα δεδομένα' },
                    { value: 'refinitiv', label: 'Refinitiv', desc: '15-min delayed live data' },
                    { value: 'ice', label: 'ICE', desc: '15-min delayed live data' }
                  ].map(provider => (
                    <button
                      key={provider.value}
                      onClick={() => setConfig(prev => ({ ...prev, dataProvider: provider.value as any }))}
                      className={`p-3 rounded-lg border text-left ${
                        config.dataProvider === provider.value
                          ? 'border-yellow-500 bg-yellow-100 dark:bg-yellow-800'
                          : 'border-gray-300 hover:bg-yellow-50'
                      }`}
                    >
                      <div className="font-medium">{provider.label}</div>
                      <div className="text-sm text-gray-600">{provider.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Περιοχή Δεδομένων
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, region: 'eu' }))}
                      className={`py-2 px-4 rounded-lg border font-medium ${
                        config.region === 'eu'
                          ? 'border-blue-500 bg-blue-100 text-blue-700'
                          : 'border-gray-300 text-gray-700'
                      }`}
                    >
                      Europe (EU)
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, region: 'us' }))}
                      className={`py-2 px-4 rounded-lg border font-medium ${
                        config.region === 'us'
                          ? 'border-blue-500 bg-blue-100 text-blue-700'
                          : 'border-gray-300 text-gray-700'
                      }`}
                    >
                      US
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Βασική Μεταβλητότητα
                  </label>
                  <input
                    type="number"
                    value={config.baseVolatility * 100}
                    onChange={(e) => setConfig(prev => ({ ...prev, baseVolatility: (parseFloat(e.target.value) || 25) / 100 }))}
                    step="0.5"
                    min="5"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <p className="text-xs text-gray-500 mt-1">Implied Volatility σε %</p>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Compliance Notice
                  </h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Όλα τα δεδομένα είναι καθυστερημένα κατά 15 λεπτά και προορίζονται αποκλειστικά για εκπαίδευση. 
                  Δεν αποτελούν επενδυτική συμβουλή. Η αποθήκευση δεδομένων γίνεται σε servers EU (GDPR compliant).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-b-lg border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Ακύρωση
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={() => createSession(false)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </button>
            
            <button
              onClick={() => createSession(true)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {saving ? 'Δημιουργία...' : 'Δημιουργία & Έναρξη'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
