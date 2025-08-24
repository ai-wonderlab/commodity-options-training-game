import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { FillEngine } from '@game/shared';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const order = await request.json();

    // Validate required fields
    if (!order.session_id || !order.participant_id || !order.symbol || !order.qty) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // If Supabase not configured, return mock fill
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      const mockFill = {
        orderId: `ORDER-${Date.now()}`,
        fillPrice: order.limit_price || 82.50,
        fees: order.qty * 2.50,
        status: 'FILLED'
      };
      return NextResponse.json(mockFill);
    }

    // Get current market price
    const { data: latestTick, error: tickError } = await supabase
      .from('ticks')
      .select('*')
      .eq('symbol', order.symbol)
      .order('ts', { ascending: false })
      .limit(1)
      .single();

    if (tickError || !latestTick) {
      // Use default price if no tick available
      const defaultPrice = order.symbol === 'BRN' ? 82.50 : 2.50;
      latestTick = {
        symbol: order.symbol,
        best_bid: defaultPrice - 0.05,
        best_ask: defaultPrice + 0.05,
        mid: defaultPrice,
        last: defaultPrice
      };
    }

    // Determine fill price based on order type
    let fillPrice: number;
    if (order.type === 'LMT') {
      // Limit order: check if price is achievable
      if (order.side === 'BUY' && order.limit_price < latestTick.best_ask) {
        return NextResponse.json(
          { error: 'Limit price too low for immediate fill' },
          { status: 400 }
        );
      }
      if (order.side === 'SELL' && order.limit_price > latestTick.best_bid) {
        return NextResponse.json(
          { error: 'Limit price too high for immediate fill' },
          { status: 400 }
        );
      }
      fillPrice = order.limit_price;
    } else {
      // Market order: use best bid/ask
      fillPrice = order.side === 'BUY' ? latestTick.best_ask : latestTick.best_bid;
    }

    // Calculate fees
    const fees = order.qty * 2.50; // $2.50 per contract

    // Insert order into database
    const { data: insertedOrder, error: insertError } = await supabase
      .from('orders')
      .insert({
        session_id: order.session_id,
        participant_id: order.participant_id,
        ts: new Date().toISOString(),
        side: order.side,
        type: order.type,
        symbol: order.symbol,
        expiry: order.expiry,
        strike: order.strike,
        opt_type: order.opt_type,
        qty: order.qty,
        limit_price: order.limit_price,
        iv_override: order.iv_override,
        status: 'FILLED',
        fill_price: fillPrice,
        fees: fees,
        filled_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Order insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      );
    }

    // Update position
    const positionKey = {
      participant_id: order.participant_id,
      symbol: order.symbol,
      expiry: order.expiry || '1900-01-01',
      strike: order.strike || 0,
      opt_type: order.opt_type || ''
    };

    // Get current position
    const { data: currentPosition } = await supabase
      .from('positions')
      .select('*')
      .match(positionKey)
      .single();

    const qtyChange = order.side === 'BUY' ? order.qty : -order.qty;
    
    if (currentPosition) {
      // Update existing position
      const newNetQty = currentPosition.net_qty + qtyChange;
      
      let newAvgPrice = currentPosition.avg_price;
      if (order.side === 'BUY' && newNetQty > 0) {
        // Averaging up/down on long position
        newAvgPrice = (
          (currentPosition.net_qty * currentPosition.avg_price + order.qty * fillPrice) /
          newNetQty
        );
      } else if (order.side === 'SELL' && newNetQty < 0) {
        // Averaging up/down on short position
        newAvgPrice = (
          (Math.abs(currentPosition.net_qty) * currentPosition.avg_price + order.qty * fillPrice) /
          Math.abs(newNetQty)
        );
      }

      // Calculate realized P&L if closing or reducing position
      let realizedPnl = currentPosition.realized_pnl;
      if ((currentPosition.net_qty > 0 && order.side === 'SELL') ||
          (currentPosition.net_qty < 0 && order.side === 'BUY')) {
        const closedQty = Math.min(Math.abs(currentPosition.net_qty), order.qty);
        const pnlPerContract = (fillPrice - currentPosition.avg_price) * 
                               (currentPosition.net_qty > 0 ? 1 : -1);
        realizedPnl += closedQty * pnlPerContract * 1000; // 1000 barrels per contract
      }

      const { error: updateError } = await supabase
        .from('positions')
        .update({
          net_qty: newNetQty,
          avg_price: newAvgPrice,
          realized_pnl: realizedPnl,
          updated_at: new Date().toISOString()
        })
        .match(positionKey);

      if (updateError) {
        console.error('Position update error:', updateError);
      }
    } else {
      // Create new position
      const { error: insertPosError } = await supabase
        .from('positions')
        .insert({
          ...positionKey,
          net_qty: qtyChange,
          avg_price: fillPrice,
          realized_pnl: 0,
          updated_at: new Date().toISOString()
        });

      if (insertPosError) {
        console.error('Position insert error:', insertPosError);
      }
    }

    // Update leaderboard (trigger P&L calculation)
    await updateLeaderboard(order.session_id, order.participant_id);

    // Return success response
    return NextResponse.json({
      orderId: insertedOrder.id,
      fillPrice: fillPrice,
      fees: fees,
      status: 'FILLED',
      message: `Order filled: ${order.side} ${order.qty} ${order.symbol} @ ${fillPrice}`
    });

  } catch (error) {
    console.error('Order submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to update leaderboard
async function updateLeaderboard(sessionId: string, participantId: string) {
  try {
    // Get all positions for participant
    const { data: positions } = await supabase
      .from('positions')
      .select('*')
      .eq('participant_id', participantId);

    // Get latest market prices
    const { data: latestTicks } = await supabase
      .from('ticks')
      .select('*')
      .in('symbol', positions?.map(p => p.symbol) || [])
      .order('ts', { ascending: false });

    // Calculate total P&L
    let totalPnl = 0;
    let unrealizedPnl = 0;
    let realizedPnl = 0;

    positions?.forEach(position => {
      // Get latest price for this symbol
      const tick = latestTicks?.find(t => t.symbol === position.symbol);
      const currentPrice = tick?.mid || position.avg_price;

      // Calculate unrealized P&L
      if (position.net_qty !== 0) {
        unrealizedPnl += position.net_qty * (currentPrice - position.avg_price) * 1000;
      }

      // Add realized P&L
      realizedPnl += position.realized_pnl;
    });

    totalPnl = unrealizedPnl + realizedPnl;

    // Calculate score (simplified)
    const score = totalPnl + 100000; // Base score + P&L

    // Update or insert leaderboard entry
    const { error } = await supabase
      .from('leaderboard')
      .upsert({
        session_id: sessionId,
        participant_id: participantId,
        pnl: totalPnl,
        score: score,
        drawdown: Math.min(0, totalPnl), // Simplified drawdown
        penalties: 0, // TODO: Calculate penalties from breaches
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'session_id,participant_id'
      });

    if (error) {
      console.error('Leaderboard update error:', error);
    }
  } catch (error) {
    console.error('Error updating leaderboard:', error);
  }
}
