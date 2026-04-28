# ELO System Tuning Summary

## Issues Addressed

### 1. Poule Match Scoring - Too Generous to Losers
**Problem**: Lower-rated players could gain points by losing 5-4 or 5-3 matches, even against similarly-rated opponents. The old system gave losers too much credit.

**Old System**:
- 5-4 loss: 0.40 actual score (40% credit)
- 5-3 loss: 0.30 actual score (30% credit)  
- 5-2 loss: 0.20 actual score (20% credit)

**New System** (Custom margin scoring map):
- 5-4 loss: 0.35 actual score (35% credit) - Still allows small gains vs much higher rated
- 5-3 loss: 0.25 actual score (25% credit) - Minimal/no gain for losers
- 5-2 loss: 0.15 actual score (15% credit) - Clear loss of points
- 5-1 loss: 0.08 actual score (8% credit) - Heavy loss
- 5-0 loss: 0.00 actual score (0% credit) - Maximum loss

**Impact**: Lower-rated players must now win at least 5-3 to have a chance at gaining points against similar opponents, and must win 5-4 or better to gain from higher-rated players.

### 2. Decay System - Wrong Direction
**Problem**: All inactive players decayed toward starting rating (1800), meaning:
- High-rated veterans (e.g., 2100) would decay down to 1800 (correct)
- Low-rated players (e.g., 1600) would decay UP to 1800 (wrong!)

**Old System**:
- Everyone decayed toward 1800 (STARTING_RATING)
- Decay rate: 10% per session after 6 sessions inactive
- Formula: `new_rating = old_rating * 0.9 + 1800 * 0.1`

**New System**:
- Only players rated **above 1900** decay
- Decay target: 1900 (DECAY_TARGET) - a "high skill floor" above starting rating
- Decay rate: 8% per session after 6 sessions inactive
- Formula: `if rating > 1900: new_rating = old_rating * 0.92 + 1900 * 0.08`

**Impact**: 
- Established players (>1900) who stop attending will slowly decay to 1900 (not 1800)
- New/lower-rated players (<1900) keep their rating when inactive (no artificial inflation)
- The 1900 floor recognizes that anyone who achieved that rating earned it

## Testing the Changes

### Poule Scoring Examples

**Example 1: Lower rated loses close match**
- Player A: 1700, Player B: 1900 (200 point gap)
- Result: B wins 5-4
- Expected score for A: ~0.24
- Actual score for A: 0.35
- **Result**: A gains ~3-4 points (close loss to much better opponent)

**Example 2: Lower rated loses clear match**
- Player A: 1700, Player B: 1900
- Result: B wins 5-3
- Expected score for A: ~0.24
- Actual score for A: 0.25
- **Result**: A gains ~0 points (minimal change)

**Example 3: Lower rated loses decisively**
- Player A: 1700, Player B: 1900
- Result: B wins 5-2
- Expected score for A: ~0.24
- Actual score for A: 0.15
- **Result**: A **loses** points as expected

### Decay Examples

**Example 1: Veteran takes 8 weeks off**
- Starting rating: 2100
- After 6 sessions inactive: 2100 (no decay yet)
- After 7 sessions: 2100 * 0.92 + 1900 * 0.08 = 2084
- After 8 sessions: 2084 * 0.92 + 1900 * 0.08 = 2069
- After 10 sessions: ~2041
- Long-term: Approaches 1900 asymptotically

**Example 2: Newer player takes time off**
- Starting rating: 1750
- After any number of sessions: **1750** (no decay below 1900)

## Configuration Changes Made

### File: `src/track_match_history.py`

1. **MARGIN_SCORE_MAP** (lines ~69-77):
   - Changed from `None` to custom mapping
   - Tuned values to reduce loser credit

2. **DECAY_TARGET** (line ~120):
   - New constant: 1900
   - Decay floor for high-rated players

3. **DECAY_RATE** (line ~119):
   - Changed from 0.1 (10%) to 0.08 (8%)
   - Slightly slower decay to new target

4. **apply_decay_for_inactive_fencers()** (lines ~387-400):
   - Added condition: only decay if `rating > DECAY_TARGET`
   - Changed target from `STARTING_RATING` to `DECAY_TARGET`
   - Added floor: `new_rating = max(DECAY_TARGET, new_rating)`

## Re-running the System

To apply these changes to your existing data:

```bash
cd /Users/ayule/PycharmProjects/FencingTracker/src
python3 track_match_history.py
```

This will recalculate all historical ratings with the new scoring system.

## Expected Outcomes

1. **Rating spread will be tighter**: Fewer players will have inflated ratings from accumulating small gains on losses
2. **Top-end ratings more stable**: High performers won't decay as far when inactive
3. **Bottom-end more accurate**: Struggling players won't get artificial boosts from close losses
4. **Clearer skill differentiation**: Winning decisively (5-2 or better) matters more
