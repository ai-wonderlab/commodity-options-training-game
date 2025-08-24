'use client';

import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Plus, 
  Minus, 
  Target, 
  TrendingUp, 
  TrendingDown,
  Shield,
  Zap,
  BookOpen,
  Settings,
  RotateCcw,
  Copy,
  Download,
  Eye,
  AlertTriangle
} from 'lucide-react';

interface StrategyLeg {
  id: string;
  action: 'BUY' | 'SELL';
  instrument: 'FUTURE' | 'CALL' | 'PUT';
  strike?: number;
  expiry: string;
  quantity: number;
  price?: number;
}

interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  category: 'bullish' | 'bearish' | 'neutral' | 'volatility';
  difficulty: 'basic' | 'intermediate' | 'advanced';
  legs: Omit<StrategyLeg, 'id' | 'price'>[];
  explanation: string;
  maxProfit: string;
  maxLoss: string;
  breakeven: string[];
  bestScenario: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface StrategyAnalysis {
  totalCost: number;
  maxProfit: number;
  maxLoss: number;
  breakevens: number[];
  profitRange: [number, number];
  riskReward: number;
  greeks: {
    delta: number;
    gamma: number;
    vega: number;
    theta: number;
  };
}

interface StrategyBuilderProps {
  currentPrice: number;
  currentVol: number;
  availableStrikes: number[];
  availableExpiries: string[];
  onStrategyExecute?: (legs: StrategyLeg[]) => void;
}

// Predefined strategy templates
const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'long_call',
    name: 'Long Call',
    description: 'Αγορά call option - βασική bullish στρατηγική',
    category: 'bullish',
    difficulty: 'basic',
    legs: [
      { action: 'BUY', instrument: 'CALL', quantity: 1, expiry: '1M' }
    ],
    explanation: 'Προσδοκάτε άνοδο της τιμής πάνω από το strike + premium. Περιορισμένος κίνδυνος, απεριόριστο κέρδος.',
    maxProfit: 'Απεριόριστο',
    maxLoss: 'Premium που πληρώθηκε',
    breakeven: ['Strike + Premium'],
    bestScenario: 'Σημαντική άνοδος τιμής',
    riskLevel: 'medium'
  },
  {
    id: 'long_put',
    name: 'Long Put',
    description: 'Αγορά put option - βασική bearish στρατηγική',
    category: 'bearish',
    difficulty: 'basic',
    legs: [
      { action: 'BUY', instrument: 'PUT', quantity: 1, expiry: '1M' }
    ],
    explanation: 'Προσδοκάτε πτώση της τιμής κάτω από το strike - premium. Περιορισμένος κίνδυνος.',
    maxProfit: 'Strike - Premium',
    maxLoss: 'Premium που πληρώθηκε',
    breakeven: ['Strike - Premium'],
    bestScenario: 'Σημαντική πτώση τιμής',
    riskLevel: 'medium'
  },
  {
    id: 'covered_call',
    name: 'Covered Call',
    description: 'Futures + Short Call - εισόδημα σε ουδέτερη αγορά',
    category: 'neutral',
    difficulty: 'intermediate',
    legs: [
      { action: 'BUY', instrument: 'FUTURE', quantity: 1, expiry: '1M' },
      { action: 'SELL', instrument: 'CALL', quantity: 1, expiry: '1M' }
    ],
    explanation: 'Κερδίζετε το premium του call αν η τιμή μένει κάτω από το strike. Περιορίζετε το upside.',
    maxProfit: 'Strike - Τιμή Αγοράς + Premium',
    maxLoss: 'Τιμή Αγοράς - Premium',
    breakeven: ['Τιμή Αγοράς - Premium'],
    bestScenario: 'Μικρή άνοδος έως το strike',
    riskLevel: 'medium'
  },
  {
    id: 'protective_put',
    name: 'Protective Put',
    description: 'Futures + Long Put - προστασία θέσης',
    category: 'neutral',
    difficulty: 'intermediate',
    legs: [
      { action: 'BUY', instrument: 'FUTURE', quantity: 1, expiry: '1M' },
      { action: 'BUY', instrument: 'PUT', quantity: 1, expiry: '1M' }
    ],
    explanation: 'Ασφάλιση της futures θέσης έναντι πτώσης. Όπως ασφάλεια αυτοκινήτου.',
    maxProfit: 'Απεριόριστο',
    maxLoss: 'Τιμή Αγοράς - Strike + Premium',
    breakeven: ['Τιμή Αγοράς + Premium'],
    bestScenario: 'Άνοδος με προστασία από πτώση',
    riskLevel: 'low'
  },
  {
    id: 'bull_call_spread',
    name: 'Bull Call Spread',
    description: 'Long Call (ITM) + Short Call (OTM) - μέτρια bullish στρατηγική',
    category: 'bullish',
    difficulty: 'intermediate',
    legs: [
      { action: 'BUY', instrument: 'CALL', quantity: 1, expiry: '1M' },
      { action: 'SELL', instrument: 'CALL', quantity: 1, expiry: '1M' }
    ],
    explanation: 'Μειωμένο κόστος αλλά περιορισμένο κέρδος. Χρήσιμο όταν περιμένετε μέτρια άνοδο.',
    maxProfit: 'Διαφορά Strikes - Καθαρό Premium',
    maxLoss: 'Καθαρό Premium που πληρώθηκε',
    breakeven: ['Lower Strike + Καθαρό Premium'],
    bestScenario: 'Τιμή στο ή πάνω από το ανώτερο strike',
    riskLevel: 'medium'
  },
  {
    id: 'bear_put_spread',
    name: 'Bear Put Spread',
    description: 'Long Put (ITM) + Short Put (OTM) - μέτρια bearish στρατηγική',
    category: 'bearish',
    difficulty: 'intermediate',
    legs: [
      { action: 'BUY', instrument: 'PUT', quantity: 1, expiry: '1M' },
      { action: 'SELL', instrument: 'PUT', quantity: 1, expiry: '1M' }
    ],
    explanation: 'Μειωμένο κόστος bearish position. Κέρδος όταν η τιμή πέφτει μέτρια.',
    maxProfit: 'Διαφορά Strikes - Καθαρό Premium',
    maxLoss: 'Καθαρό Premium που πληρώθηκε',
    breakeven: ['Higher Strike - Καθαρό Premium'],
    bestScenario: 'Τιμή στο ή κάτω από το κατώτερο strike',
    riskLevel: 'medium'
  },
  {
    id: 'long_straddle',
    name: 'Long Straddle',
    description: 'Long Call + Long Put (ίδιο strike) - αναμονή μεγάλης κίνησης',
    category: 'volatility',
    difficulty: 'advanced',
    legs: [
      { action: 'BUY', instrument: 'CALL', quantity: 1, expiry: '1M' },
      { action: 'BUY', instrument: 'PUT', quantity: 1, expiry: '1M' }
    ],
    explanation: 'Κερδίζετε από μεγάλες κινήσεις προς οποιαδήποτε κατεύθυνση. Υψηλό κόστος.',
    maxProfit: 'Απεριόριστο',
    maxLoss: 'Συνολικό Premium',
    breakeven: ['Strike ± Συνολικό Premium'],
    bestScenario: 'Μεγάλη κίνηση (άνοδος ή πτώση)',
    riskLevel: 'high'
  },
  {
    id: 'short_strangle',
    name: 'Short Strangle',
    description: 'Short Call (OTM) + Short Put (OTM) - εισόδημα σε ήρεμη αγορά',
    category: 'neutral',
    difficulty: 'advanced',
    legs: [
      { action: 'SELL', instrument: 'CALL', quantity: 1, expiry: '1M' },
      { action: 'SELL', instrument: 'PUT', quantity: 1, expiry: '1M' }
    ],
    explanation: 'Εισπράττετε premiums αν η τιμή μείνει στο εύρος. Απεριόριστος κίνδυνος.',
    maxProfit: 'Συνολικό Premium που εισπράχθηκε',
    maxLoss: 'Απεριόριστο',
    breakeven: ['Call Strike + Premium', 'Put Strike - Premium'],
    bestScenario: 'Χαμηλή μεταβλητότητα, τιμή στο εύρος',
    riskLevel: 'high'
  },
  {
    id: 'iron_condor',
    name: 'Iron Condor',
    description: 'Bull Put Spread + Bear Call Spread - εισόδημα με περιορισμένο κίνδυνο',
    category: 'neutral',
    difficulty: 'advanced',
    legs: [
      { action: 'SELL', instrument: 'PUT', quantity: 1, expiry: '1M' }, // Higher strike put
      { action: 'BUY', instrument: 'PUT', quantity: 1, expiry: '1M' },  // Lower strike put
      { action: 'SELL', instrument: 'CALL', quantity: 1, expiry: '1M' }, // Lower strike call
      { action: 'BUY', instrument: 'CALL', quantity: 1, expiry: '1M' }   // Higher strike call
    ],
    explanation: 'Πολύπλοκη στρατηγική εισοδήματος. Κερδίζετε αν η τιμή μείνει στο κεντρικό εύρος.',
    maxProfit: 'Καθαρό Premium που εισπράχθηκε',
    maxLoss: 'Διαφορά Strike - Καθαρό Premium',
    breakeven: ['2 σημεία - υπολογισμός πολύπλοκος'],
    bestScenario: 'Χαμηλή μεταβλητότητα στο κεντρικό εύρος',
    riskLevel: 'medium'
  }
];

export default function StrategyBuilder({
  currentPrice,
  currentVol,
  availableStrikes,
  availableExpiries,
  onStrategyExecute
}: StrategyBuilderProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<StrategyTemplate | null>(null);
  const [customLegs, setCustomLegs] = useState<StrategyLeg[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<StrategyAnalysis | null>(null);
  const [mode, setMode] = useState<'templates' | 'custom'>('templates');

  // Filter templates by category and difficulty
  const filteredTemplates = STRATEGY_TEMPLATES.filter(template => {
    if (selectedCategory === 'all') return true;
    return template.category === selectedCategory;
  });

  // Auto-calculate strikes based on current price
  const getAutoStrikes = (template: StrategyTemplate) => {
    const baseStrikes = availableStrikes.length > 0 
      ? availableStrikes 
      : generateStrikesAroundPrice(currentPrice);
    
    return template.legs.map((leg, index) => {
      let strike = currentPrice;
      
      // Auto-assign strikes based on strategy logic
      if (template.id === 'bull_call_spread') {
        strike = index === 0 ? getNearStrike(baseStrikes, currentPrice, 'ITM') 
                             : getNearStrike(baseStrikes, currentPrice, 'OTM_CALL');
      } else if (template.id === 'bear_put_spread') {
        strike = index === 0 ? getNearStrike(baseStrikes, currentPrice, 'ITM_PUT') 
                             : getNearStrike(baseStrikes, currentPrice, 'OTM_PUT');
      } else if (template.id === 'long_straddle') {
        strike = getNearStrike(baseStrikes, currentPrice, 'ATM');
      } else if (template.id === 'short_strangle') {
        strike = index === 0 ? getNearStrike(baseStrikes, currentPrice, 'OTM_CALL')
                             : getNearStrike(baseStrikes, currentPrice, 'OTM_PUT');
      } else if (template.id === 'iron_condor') {
        const strikes = [
          getNearStrike(baseStrikes, currentPrice - 5, 'NEAR'), // Short put
          getNearStrike(baseStrikes, currentPrice - 10, 'NEAR'), // Long put
          getNearStrike(baseStrikes, currentPrice + 5, 'NEAR'), // Short call
          getNearStrike(baseStrikes, currentPrice + 10, 'NEAR')  // Long call
        ];
        strike = strikes[index];
      } else {
        // Default: ATM for single leg strategies
        strike = getNearStrike(baseStrikes, currentPrice, 'ATM');
      }
      
      return strike;
    });
  };

  // Helper function to find appropriate strike
  const getNearStrike = (strikes: number[], price: number, type: string): number => {
    const sorted = [...strikes].sort((a, b) => a - b);
    
    switch (type) {
      case 'ATM':
        return sorted.reduce((prev, curr) => 
          Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev
        );
      case 'ITM':
      case 'ITM_PUT':
        return sorted.filter(s => s < price).pop() || price - 2.5;
      case 'OTM_CALL':
        return sorted.find(s => s > price) || price + 2.5;
      case 'OTM_PUT':
        return sorted.filter(s => s < price).pop() || price - 2.5;
      case 'NEAR':
        return sorted.reduce((prev, curr) => 
          Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev
        );
      default:
        return price;
    }
  };

  // Generate strikes around current price
  const generateStrikesAroundPrice = (price: number): number[] => {
    const strikes = [];
    for (let i = -10; i <= 10; i++) {
      strikes.push(Math.round((price + i * 2.5) * 4) / 4); // Round to nearest 0.25
    }
    return strikes;
  };

  // Apply template strategy
  const applyTemplate = (template: StrategyTemplate) => {
    setSelectedTemplate(template);
    
    const autoStrikes = getAutoStrikes(template);
    const expiry = availableExpiries[0] || '2024-01-19';
    
    const legs: StrategyLeg[] = template.legs.map((leg, index) => ({
      id: `leg_${Date.now()}_${index}`,
      ...leg,
      strike: leg.instrument === 'FUTURE' ? undefined : autoStrikes[index],
      expiry,
      price: 0 // Will be calculated
    }));
    
    setCustomLegs(legs);
    setMode('custom');
  };

  // Add custom leg
  const addCustomLeg = () => {
    const newLeg: StrategyLeg = {
      id: `leg_${Date.now()}`,
      action: 'BUY',
      instrument: 'CALL',
      strike: currentPrice,
      expiry: availableExpiries[0] || '2024-01-19',
      quantity: 1,
      price: 0
    };
    setCustomLegs([...customLegs, newLeg]);
  };

  // Remove leg
  const removeLeg = (id: string) => {
    setCustomLegs(customLegs.filter(leg => leg.id !== id));
  };

  // Update leg
  const updateLeg = (id: string, updates: Partial<StrategyLeg>) => {
    setCustomLegs(customLegs.map(leg => 
      leg.id === id ? { ...leg, ...updates } : leg
    ));
  };

  // Execute strategy
  const executeStrategy = () => {
    if (customLegs.length === 0) return;
    
    if (onStrategyExecute) {
      onStrategyExecute(customLegs);
    }
  };

  // Mock analysis calculation
  const calculateAnalysis = (): StrategyAnalysis => {
    let totalCost = 0;
    let totalDelta = 0;
    
    customLegs.forEach(leg => {
      // Mock premium calculation
      const premium = leg.instrument === 'FUTURE' ? 0 : 
                      leg.strike ? Math.max(1, Math.abs(leg.strike - currentPrice) * 0.05) : 0;
      
      const cost = (leg.action === 'BUY' ? premium : -premium) * leg.quantity;
      totalCost += cost;
      
      // Mock delta calculation
      const delta = leg.instrument === 'FUTURE' ? (leg.action === 'BUY' ? 1000 : -1000) :
                    leg.instrument === 'CALL' ? (leg.action === 'BUY' ? 500 : -500) :
                    (leg.action === 'BUY' ? -500 : 500);
      totalDelta += delta * leg.quantity;
    });
    
    return {
      totalCost,
      maxProfit: totalCost > 0 ? Infinity : Math.abs(totalCost),
      maxLoss: totalCost < 0 ? Infinity : totalCost,
      breakevens: [currentPrice + totalCost / 1000],
      profitRange: [currentPrice - 10, currentPrice + 10],
      riskReward: totalCost !== 0 ? 1.5 : 1,
      greeks: {
        delta: totalDelta,
        gamma: 100,
        vega: 200,
        theta: -50
      }
    };
  };

  // Update analysis when legs change
  useEffect(() => {
    if (customLegs.length > 0) {
      setAnalysis(calculateAnalysis());
    }
  }, [customLegs]);

  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'bullish': return <TrendingUp className="w-4 h-4" />;
      case 'bearish': return <TrendingDown className="w-4 h-4" />;
      case 'neutral': return <Target className="w-4 h-4" />;
      case 'volatility': return <Zap className="w-4 h-4" />;
      default: return <Layers className="w-4 h-4" />;
    }
  };

  // Get risk level color
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Strategy Builder</h3>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('templates')}
              className={`px-3 py-1 rounded-lg text-sm ${
                mode === 'templates' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <BookOpen className="w-4 h-4 inline mr-1" />
              Templates
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`px-3 py-1 rounded-lg text-sm ${
                mode === 'custom' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-1" />
              Custom
            </button>
          </div>
        </div>

        {/* Current Market Info */}
        <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="text-center">
            <div className="text-sm text-gray-500">Current Price</div>
            <div className="font-bold text-gray-900 dark:text-white">${currentPrice.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">Implied Vol</div>
            <div className="font-bold text-gray-900 dark:text-white">{(currentVol * 100).toFixed(1)}%</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">Strategies</div>
            <div className="font-bold text-gray-900 dark:text-white">{STRATEGY_TEMPLATES.length}</div>
          </div>
        </div>
      </div>

      {/* Templates Mode */}
      {mode === 'templates' && (
        <div className="space-y-4">
          {/* Category Filter */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  selectedCategory === 'all' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                Όλες
              </button>
              {['bullish', 'bearish', 'neutral', 'volatility'].map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm capitalize ${
                    selectedCategory === category 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {getCategoryIcon(category)}
                  {category === 'bullish' ? 'Ανοδικές' :
                   category === 'bearish' ? 'Καθοδικές' :
                   category === 'neutral' ? 'Ουδέτερες' : 'Μεταβλητότητα'}
                </button>
              ))}
            </div>
          </div>

          {/* Strategy Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                className={`bg-white dark:bg-gray-800 border rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
                  selectedTemplate?.id === template.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : ''
                }`}
                onClick={() => setSelectedTemplate(template)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(template.category)}
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {template.name}
                    </h4>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${getRiskColor(template.riskLevel)}`}>
                    {template.riskLevel}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {template.description}
                </p>
                
                <div className="space-y-2 mb-4">
                  <div className="text-xs">
                    <span className="font-medium text-gray-500">Max Profit:</span>
                    <span className="ml-1 text-green-600">{template.maxProfit}</span>
                  </div>
                  <div className="text-xs">
                    <span className="font-medium text-gray-500">Max Loss:</span>
                    <span className="ml-1 text-red-600">{template.maxLoss}</span>
                  </div>
                  <div className="text-xs">
                    <span className="font-medium text-gray-500">Legs:</span>
                    <span className="ml-1">{template.legs.length}</span>
                  </div>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    applyTemplate(template);
                  }}
                  className="w-full px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                >
                  Χρήση Template
                </button>
              </div>
            ))}
          </div>

          {/* Template Details */}
          {selectedTemplate && (
            <div className="bg-white dark:bg-gray-800 border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${
                  selectedTemplate.category === 'bullish' ? 'bg-green-100 text-green-600' :
                  selectedTemplate.category === 'bearish' ? 'bg-red-100 text-red-600' :
                  selectedTemplate.category === 'neutral' ? 'bg-blue-100 text-blue-600' :
                  'bg-yellow-100 text-yellow-600'
                }`}>
                  {getCategoryIcon(selectedTemplate.category)}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {selectedTemplate.name}
                  </h4>
                  <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="font-medium text-gray-900 dark:text-white mb-2">Επεξήγηση</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {selectedTemplate.explanation}
                  </p>
                  
                  <h5 className="font-medium text-gray-900 dark:text-white mb-2">Καλύτερο Σενάριο</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedTemplate.bestScenario}
                  </p>
                </div>

                <div>
                  <h5 className="font-medium text-gray-900 dark:text-white mb-2">Βασικά Στοιχεία</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Max Profit:</span>
                      <span className="text-green-600">{selectedTemplate.maxProfit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Max Loss:</span>
                      <span className="text-red-600">{selectedTemplate.maxLoss}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Breakeven:</span>
                      <span className="text-gray-900 dark:text-white">
                        {selectedTemplate.breakeven.join(', ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Επίπεδο:</span>
                      <span className="capitalize">{selectedTemplate.difficulty}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Custom Mode */}
      {mode === 'custom' && (
        <div className="space-y-4">
          {/* Strategy Legs */}
          <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Strategy Legs</h4>
              <div className="flex gap-2">
                <button
                  onClick={addCustomLeg}
                  className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Leg
                </button>
                <button
                  onClick={() => setCustomLegs([])}
                  className="flex items-center gap-1 px-3 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600"
                >
                  <RotateCcw className="w-4 h-4" />
                  Clear
                </button>
              </div>
            </div>

            {customLegs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Προσθέστε legs για να δημιουργήσετε τη στρατηγική σας</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customLegs.map((leg, index) => (
                  <div key={leg.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="text-sm font-medium text-gray-500 w-8">
                      #{index + 1}
                    </div>
                    
                    <select
                      value={leg.action}
                      onChange={(e) => updateLeg(leg.id, { action: e.target.value as 'BUY' | 'SELL' })}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                    
                    <select
                      value={leg.instrument}
                      onChange={(e) => updateLeg(leg.id, { 
                        instrument: e.target.value as 'FUTURE' | 'CALL' | 'PUT',
                        strike: e.target.value === 'FUTURE' ? undefined : leg.strike
                      })}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      <option value="FUTURE">FUTURE</option>
                      <option value="CALL">CALL</option>
                      <option value="PUT">PUT</option>
                    </select>
                    
                    {leg.instrument !== 'FUTURE' && (
                      <input
                        type="number"
                        value={leg.strike || ''}
                        onChange={(e) => updateLeg(leg.id, { strike: parseFloat(e.target.value) || undefined })}
                        placeholder="Strike"
                        className="w-20 px-2 py-1 border rounded text-sm"
                        step="0.25"
                      />
                    )}
                    
                    <select
                      value={leg.expiry}
                      onChange={(e) => updateLeg(leg.id, { expiry: e.target.value })}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      {availableExpiries.map(exp => (
                        <option key={exp} value={exp}>
                          {new Date(exp).toLocaleDateString('el-GR')}
                        </option>
                      ))}
                    </select>
                    
                    <input
                      type="number"
                      value={leg.quantity}
                      onChange={(e) => updateLeg(leg.id, { quantity: parseInt(e.target.value) || 1 })}
                      className="w-16 px-2 py-1 border rounded text-sm"
                      min="1"
                      max="10"
                    />
                    
                    <button
                      onClick={() => removeLeg(leg.id)}
                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Analysis */}
          {analysis && (
            <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900 dark:text-white">Strategy Analysis</h4>
                <button
                  onClick={() => setShowAnalysis(!showAnalysis)}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 rounded-lg"
                >
                  <Eye className="w-4 h-4" />
                  {showAnalysis ? 'Hide' : 'Show'} Details
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-sm text-gray-500">Net Cost</div>
                  <div className={`font-bold ${analysis.totalCost >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${Math.abs(analysis.totalCost).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">
                    {analysis.totalCost >= 0 ? 'Debit' : 'Credit'}
                  </div>
                </div>
                
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-sm text-gray-500">Max Profit</div>
                  <div className="font-bold text-green-600">
                    {analysis.maxProfit === Infinity ? '∞' : `$${analysis.maxProfit.toLocaleString()}`}
                  </div>
                </div>
                
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-sm text-gray-500">Max Loss</div>
                  <div className="font-bold text-red-600">
                    {analysis.maxLoss === Infinity ? '∞' : `$${analysis.maxLoss.toLocaleString()}`}
                  </div>
                </div>
                
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-sm text-gray-500">Risk/Reward</div>
                  <div className="font-bold text-gray-900 dark:text-white">
                    {analysis.riskReward.toFixed(2)}:1
                  </div>
                </div>
              </div>

              {showAnalysis && (
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-500">Delta</div>
                    <div className="font-bold">{analysis.greeks.delta.toFixed(0)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500">Gamma</div>
                    <div className="font-bold">{analysis.greeks.gamma.toFixed(0)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500">Vega</div>
                    <div className="font-bold">{analysis.greeks.vega.toFixed(0)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500">Theta</div>
                    <div className="font-bold">{analysis.greeks.theta.toFixed(0)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Execute Button */}
          {customLegs.length > 0 && (
            <div className="flex justify-center">
              <button
                onClick={executeStrategy}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Target className="w-5 h-5" />
                Execute Strategy
              </button>
            </div>
          )}

          {/* Risk Warning */}
          {analysis && (analysis.maxLoss === Infinity || analysis.maxLoss > 50000) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <div>
                  <h5 className="font-medium text-yellow-800">Προσοχή: Υψηλός Κίνδυνος</h5>
                  <p className="text-sm text-yellow-700 mt-1">
                    Η στρατηγική έχει υψηλό ή απεριόριστο κίνδυνο. Βεβαιωθείτε ότι καταλαβαίνετε τους κινδύνους.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
