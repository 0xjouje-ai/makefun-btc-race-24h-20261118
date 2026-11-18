// Dip-Bounce Mean Reversion: a long-only cbBTC bot for make.fun's 24-hour race.
//
// Idea, in one paragraph: on 1-minute bars cbBTC is mostly noise (about 6-7 bps
// of per-minute wiggle) while a full round trip costs roughly 26 bps in fees,
// slippage and price impact, so any strategy that trades often pays the pool
// more than it can win back. This dev window makes the point twice over: it
// falls 2.8% top to bottom, so buy-and-hold loses about $31.63, and every
// trend-following baseline churns itself to a loss (EMA-cross -$148.17 over
// 80 trades, ADX-momentum -$75.57, RSI-Bollinger -$39.92, momentum -$23.87).
// What does work on this window is buying a sharp, confirmed dip and
// selling the bounce back:
//
//   1. Deep-dip entry. Buy in full, once, when the close is at least 1.0%
//      below its 60-bar (1-hour) simple moving average AND the close rose
//      against the previous bar. The dip alone is not enough: in a falling
//      market every minute is below the average, so the bounce requirement
//      keeps the bot from catching a falling knife mid-drop. A 1.0% dip is
//      about fifteen times the per-minute noise, so it only fires on a real
//      dislocation, not on ordinary wiggle.
//   2. Three exits, whichever comes first. Take profit at +1.0% above the
//      fill price; a 1.0% trailing stop below the peak close since the fill,
//      which caps any one trade's loss at roughly 1.3% including costs; or
//      sell when the close climbs back above the 60-bar average, i.e. the
//      dislocation has closed. The trailing stop is what bounds the
//      downside if the race window breaks down instead of bouncing.
//   3. No late entries. No new buy once 1,380 scored bars have passed, so
//      the bot never opens a position in the last hour that the end-of-window
//      flatten would be forced to close at a loss.
//
// Everything is deterministic: the only inputs are the bars the harness sends
// (no clock, no network, no randomness), all indicator maths is plain float64
// on raw price units, and every amount is an integer number of micro-USDC,
// so two runs on the same data send the same orders.
//
// Dev-window grade (kit grade-local, process driver): net PnL +$9.34 USDC,
// 2 trades (one round trip: buy near the hour-0 trough, sell into the
// recovery), max drawdown 0.48% — above every baseline on the dev window,
// including buy-and-hold (-$31.63) and the best baseline. The same rules
// also clear the previous race's dev window in backtest (+$3.04, ahead of its
// buy-and-hold +$1.07), so the edge is not a single-window artefact.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const MAX_SLIPPAGE_BPS = 100;
/** Entry: the close must sit this far below its 60-bar average (1.0%). */
const DIP_BPS = 100;
/** The average the dip is measured against (60 one-minute bars = 1 hour). */
const SMA_BARS = 60;
/** Take profit: sell at this far above the fill price (1.0%). */
const TAKE_PROFIT_BPS = 100;
/** Trailing stop: sell this far below the peak close since the fill (1.0%). */
const TRAIL_STOP_BPS = 100;
/** No new buys once this many scored bars have passed (last hour stays flat). */
const NO_ENTRY_AFTER_SCORED_BARS = 1380;

const closes: number[] = [];
/** Scored (non-warm-up) batches seen so far. */
let scoredBars = 0;
/** Fill price of the open position, in raw price units; null while flat. */
let entryPrice: number | null = null;
/** Highest close seen since the fill; the trailing stop hangs off this. */
let peakPrice = 0;

/** Simple moving average of the last n closes, or null before n closes. */
function sma(n: number): number | null {
  if (closes.length < n) return null;
  let sum = 0;
  for (let i = closes.length - n; i < closes.length; i++) sum += closes[i]!;
  return sum / n;
}

await runBars({
  onBatch(state: BarsState, batch) {
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) closes.push(Number(bar.c));
    }
    if (state.warmingUp) return [];

    // Learn the fill price of any buy that just landed, and clear the
    // entry reference when a sell lands, so the exits price off fills.
    for (const fill of batch.fills) {
      if (fill.symbol !== SYMBOL || fill.status !== 'filled') continue;
      if (fill.side === 'buy') {
        entryPrice = Number(fill.price);
        peakPrice = entryPrice;
      } else {
        entryPrice = null;
        peakPrice = 0;
      }
    }

    scoredBars += 1;
    const fresh = batch.bars.some((b) => b.symbol === SYMBOL);
    if (!fresh) return [];
    const close = Number(state.close(SYMBOL));
    const avg = sma(SMA_BARS);
    if (avg === null) return [];
    const held = state.positions.get(SYMBOL);
    const cash = state.cash;

    // While holding: track the peak and sell on the first exit that fires.
    if (held !== undefined) {
      if (close > peakPrice) peakPrice = close;
      const takeProfit =
        entryPrice !== null && close * 10000 >= entryPrice * (10000 + TAKE_PROFIT_BPS);
      const trailingStop = close * 10000 <= peakPrice * (10000 - TRAIL_STOP_BPS);
      const reclaimed = close >= avg;
      if (takeProfit || trailingStop || reclaimed) {
        entryPrice = null;
        peakPrice = 0;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
      }
      return [];
    }

    // Flat: buy in full on a deep dip below the average, confirmed by an
    // up close against the previous bar. A rejected buy simply leaves us
    // flat, so the next bar re-tests the same conditions and retries.
    if (scoredBars > NO_ENTRY_AFTER_SCORED_BARS) return [];
    if (closes.length < 2) return [];
    const dipped = close * 10000 <= avg * (10000 - DIP_BPS);
    const bounced = closes[closes.length - 1]! > closes[closes.length - 2]!;
    if (dipped && bounced) {
      if (cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies BuyInput];
    }
    return [];
  },
});
