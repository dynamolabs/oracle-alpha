# 🎬 Demo Recording Guide

Quick guide for recording the Oracle Alpha demo video.

## Option 1: Screen Record (Recommended)

### Setup
1. Open browser to http://45.77.42.204:3900/
2. Use screen recording software (OBS, Loom, or built-in)
3. Set resolution to 1920x1080

### Recording Flow (2-3 min)

**Scene 1: Dashboard Overview (30s)**
- Show main dashboard with signals
- Point out score, risk levels, source indicators
- Show live ticker updating

**Scene 2: Signal Details (30s)**
- Click on a high-score signal
- Show the detail breakdown
- Highlight sources contributing to score
- Show reasoning (if available)

**Scene 3: On-Chain Proof (45s)**
- Click "View on Solana"
- Show Solana Explorer with the signal PDA
- Point out timestamp, entry price
- This is THE killer feature - emphasize!

**Scene 4: API Demo (30s)**
- Open terminal or browser console
- Run: `curl http://45.77.42.204:3900/api/agent/signals?minScore=60`
- Show JSON response
- Mention skill.json for agent composability

**Scene 5: Performance (15s)**
- Navigate to performance section
- Show win rate, total signals, ROI stats

## Option 2: Automated GIF Demo

```bash
# Run this to generate demo GIF
cd /root/clawd/oracle-alpha
npm run demo:gif
```

## Key Points to Emphasize

1. **"Every signal on-chain BEFORE price moves"**
2. **"Cryptographic proof, not screenshots"**
3. **"Other agents can consume via skill.json"**
4. **"Track record is a blockchain, not a claim"**

## Audio Script

See `DEMO_SCRIPT.md` for full narration script.

Quick version:
> "ORACLE Alpha aggregates signals from 9 sources, scores them with AI, 
> and publishes every signal ON-CHAIN before the price moves.
> No fake screenshots. No edited timestamps. Just cryptographic proof.
> Our track record isn't a claim - it's a blockchain."

## After Recording

1. Upload to YouTube (unlisted)
2. Add to Colosseum project as `technicalDemoLink`
3. Share in forum post

## Need Help?

Run `npm run demo` to see demo mode in action.
