# makefun-btc-race-24h-20261118

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/0xjouje-ai/makefun-btc-race-24h-20261118/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/0xjouje-ai/makefun-btc-race-24h-20261118/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A long-only cbBTC trading bot for make.fun's 24-hour race. It buys a sharp, confirmed dip (close at least 1.0% below its 1-hour average, with an up close against the previous bar) and sells the bounce back — on take-profit at +1.0%, a 1.0% trailing stop, or the close reclaiming its 1-hour average. On the published dev window it grades at **+$9.34 net PnL** with 2 trades and a 0.48% max drawdown — above every baseline in the kit.

## How it works

On 1-minute bars the market is mostly noise (about 6–7 bps of per-minute wiggle) while a full round trip costs roughly 26 bps in fees, slippage and price impact, so trading often pays the pool more than it can win back. This dev window proves it: it falls 2.8% top to bottom, buy-and-hold loses $31.63, and every trend-following baseline loses — EMA-cross −$148.17 over 80 trades, ADX-momentum −$75.57, RSI-Bollinger −$39.92, momentum −$23.87. This bot therefore trades at most a handful of times:

1. **Deep-dip entry.** Buy in full when the close sits at least 1.0% below its 60-bar simple moving average *and* rose against the previous bar. The bounce requirement keeps it from catching a falling knife mid-drop; a 1.0% dip is about fifteen times the per-minute noise, so it only fires on a real dislocation.
2. **Three exits, whichever comes first.** Take profit at +1.0% above the fill price, a 1.0% trailing stop below the peak close since the fill (caps any one trade's loss at roughly 1.3% including costs), or the close climbing back above the 60-bar average.
3. **No late entries.** No new buy after 1,380 scored bars, so the bot never opens a position in the last hour that the end-of-window flatten would be forced to close at a loss.

Everything is deterministic: the only inputs are the bars the harness sends (no clock, no network, no randomness), and every amount is an integer number of micro-USDC, so two runs on the same data send the same orders.

## Run it

`main.ts` speaks the `agent-fun/bars-replay/v1` protocol (newline-delimited JSON on stdin/stdout) and is run by the grader as `node main.ts` under Node 22. To grade it on the published dev window with the kit's CLI:

```sh
node cli/makefun.mjs grade-local --kit <kit-dir> --bot . --driver process
```

Dev-window grade: net PnL **+$9.34 USDC**, 2 trades (one round trip: buy near the hour-0 trough, sell into the recovery), max drawdown 0.48%, 0 rejected orders, guardrails met. At 2x fees the net PnL is still +$8.53. The same rules also clear the previous race's dev window in backtest (+$3.04, ahead of its buy-and-hold +$1.07).

---

Entered on [make.fun](https://make.fun/?ref=z1zw2h6p&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards
