'use client';

import { 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Activity,
  Users,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { cn, cardStyles, buttonStyles, formatCurrency } from '../../lib/utils';

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Demo */}
        <div className="text-center mb-12">
          <h1 className="text-h1 font-serif font-bold text-foreground mb-4">
            🎨 UI Design System Demo
          </h1>
          <p className="text-body text-muted-foreground max-w-2xl mx-auto">
            Αυτή η σελίδα δείχνει όλα τα νέα UI components με το modern design system
          </p>
        </div>

        {/* Typography Demo */}
        <div className={cardStyles.base}>
          <div className={cardStyles.header}>
            <h2 className="text-h3 font-serif">Typography - Fonts & Sizes</h2>
          </div>
          <div className={cardStyles.content}>
            <div className="space-y-4">
              <h1 className="text-h1 font-serif">H1 - Fraunces Serif Font</h1>
              <h2 className="text-h2 font-serif">H2 - Fraunces Serif Font</h2>
              <h3 className="text-h3 font-serif">H3 - Fraunces Serif Font</h3>
              <h4 className="text-h4 font-serif">H4 - Fraunces Serif Font</h4>
              <p className="text-body font-sans">Body Text - Manrope Sans Font</p>
              <p className="text-small text-muted-foreground">Small Text - Muted Color</p>
              <p className="text-caption text-muted-foreground">Caption Text - Smallest Size</p>
            </div>
          </div>
        </div>

        {/* Colors Demo */}
        <div className={cardStyles.base}>
          <div className={cardStyles.header}>
            <h2 className="text-h3 font-serif">Color Palette</h2>
          </div>
          <div className={cardStyles.content}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="w-full h-20 bg-primary rounded-lg mb-2"></div>
                <p className="text-small">Primary</p>
              </div>
              <div className="text-center">
                <div className="w-full h-20 bg-success rounded-lg mb-2"></div>
                <p className="text-small">Success</p>
              </div>
              <div className="text-center">
                <div className="w-full h-20 bg-destructive rounded-lg mb-2"></div>
                <p className="text-small">Destructive</p>
              </div>
              <div className="text-center">
                <div className="w-full h-20 bg-warning rounded-lg mb-2"></div>
                <p className="text-small">Warning</p>
              </div>
              <div className="text-center">
                <div className="w-full h-20 bg-info rounded-lg mb-2"></div>
                <p className="text-small">Info</p>
              </div>
              <div className="text-center">
                <div className="w-full h-20 bg-muted rounded-lg mb-2"></div>
                <p className="text-small">Muted</p>
              </div>
              <div className="text-center">
                <div className="w-full h-20 bg-card border border-border rounded-lg mb-2"></div>
                <p className="text-small">Card</p>
              </div>
              <div className="text-center">
                <div className="w-full h-20 bg-background border border-border rounded-lg mb-2"></div>
                <p className="text-small">Background</p>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons Demo */}
        <div className={cardStyles.base}>
          <div className={cardStyles.header}>
            <h2 className="text-h3 font-serif">Buttons & Controls</h2>
          </div>
          <div className={cardStyles.content}>
            <div className="space-y-6">
              {/* Order Buttons */}
              <div>
                <h4 className="text-body font-bold mb-3">Order Buttons (Big & Bold)</h4>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <button className="py-4 px-6 rounded-lg font-bold text-lg bg-success text-success-foreground shadow-medium hover:shadow-hard transform hover:scale-105 transition-all flex items-center justify-center gap-2">
                    <TrendingUp className="h-6 w-6" />
                    BUY
                  </button>
                  <button className="py-4 px-6 rounded-lg font-bold text-lg bg-destructive text-destructive-foreground shadow-medium hover:shadow-hard transform hover:scale-105 transition-all flex items-center justify-center gap-2">
                    <TrendingDown className="h-6 w-6" />
                    SELL
                  </button>
                </div>
              </div>

              {/* Regular Buttons */}
              <div>
                <h4 className="text-body font-bold mb-3">Regular Buttons</h4>
                <div className="flex flex-wrap gap-3">
                  <button className={cn(buttonStyles.base, buttonStyles.variants.default, buttonStyles.sizes.default)}>
                    Primary Button
                  </button>
                  <button className={cn(buttonStyles.base, buttonStyles.variants.secondary, buttonStyles.sizes.default)}>
                    Secondary
                  </button>
                  <button className={cn(buttonStyles.base, buttonStyles.variants.outline, buttonStyles.sizes.default)}>
                    Outline
                  </button>
                  <button className={cn(buttonStyles.base, buttonStyles.variants.destructive, buttonStyles.sizes.default)}>
                    Destructive
                  </button>
                  <button className={cn(buttonStyles.base, buttonStyles.variants.success, buttonStyles.sizes.default)}>
                    Success
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cards Demo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={cn(cardStyles.base, "hover:shadow-medium transition-all")}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Users className="h-8 w-8 text-primary" />
                <span className="text-caption text-muted-foreground">LIVE</span>
              </div>
              <h3 className="text-h4 font-serif mb-2">12 Players</h3>
              <p className="text-small text-muted-foreground">Active in session</p>
            </div>
          </div>

          <div className={cn(cardStyles.base, "hover:shadow-medium transition-all")}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="h-8 w-8 text-success" />
                <span className="text-caption text-success">+12.5%</span>
              </div>
              <h3 className="text-h4 font-serif mb-2">{formatCurrency(125430)}</h3>
              <p className="text-small text-muted-foreground">Total P&L</p>
            </div>
          </div>

          <div className={cn(cardStyles.base, "hover:shadow-medium transition-all")}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <AlertTriangle className="h-8 w-8 text-warning" />
                <span className="text-caption text-warning">WARNING</span>
              </div>
              <h3 className="text-h4 font-serif mb-2">3 Breaches</h3>
              <p className="text-small text-muted-foreground">Risk limits exceeded</p>
            </div>
          </div>
        </div>

        {/* Status Badges */}
        <div className={cardStyles.base}>
          <div className={cardStyles.header}>
            <h2 className="text-h3 font-serif">Status Indicators</h2>
          </div>
          <div className={cardStyles.content}>
            <div className="flex flex-wrap gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                ACTIVE
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/20 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                WARNING
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                BREACH
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-info/10 text-info border border-info/20 flex items-center gap-1">
                <Info className="h-3 w-3" />
                INFO
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                <Activity className="h-3 w-3" />
                LIVE
              </span>
            </div>
          </div>
        </div>

        {/* Animations Demo */}
        <div className={cardStyles.base}>
          <div className={cardStyles.header}>
            <h2 className="text-h3 font-serif">Animations</h2>
          </div>
          <div className={cardStyles.content}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg animate-fade-in">
                <p className="text-small">Fade In Animation</p>
              </div>
              <div className="p-4 bg-muted rounded-lg animate-slide-in-from-bottom">
                <p className="text-small">Slide In Animation</p>
              </div>
              <div className="p-4 bg-muted rounded-lg animate-pulse-subtle">
                <p className="text-small">Pulse Animation</p>
              </div>
            </div>
          </div>
        </div>

        {/* Shadows Demo */}
        <div className={cardStyles.base}>
          <div className={cardStyles.header}>
            <h2 className="text-h3 font-serif">Shadow Effects</h2>
          </div>
          <div className={cardStyles.content}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-card rounded-lg shadow-soft">
                <p className="text-body font-bold">Soft Shadow</p>
                <p className="text-caption text-muted-foreground">shadow-soft</p>
              </div>
              <div className="p-6 bg-card rounded-lg shadow-medium">
                <p className="text-body font-bold">Medium Shadow</p>
                <p className="text-caption text-muted-foreground">shadow-medium</p>
              </div>
              <div className="p-6 bg-card rounded-lg shadow-hard">
                <p className="text-body font-bold">Hard Shadow</p>
                <p className="text-caption text-muted-foreground">shadow-hard</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
