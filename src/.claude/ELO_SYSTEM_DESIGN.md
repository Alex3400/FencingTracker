# ELO Rating System for Fencing Tournaments

## What is ELO?

ELO is a rating system that assigns each player a numerical score representing their skill level. When two players compete, the system:
1. Predicts who should win based on their current ratings
2. Updates both ratings after the match based on the actual result
3. Rewards upsets (lower-rated player winning) more than expected outcomes

The key insight: **Your rating changes based on whether you performed better or worse than expected.**

## How ELO Works

### Basic Formula

For each match:
```
Expected Score = 1 / (1 + 10^((Opponent Rating - Your Rating) / 400))

Rating Change = K × (Actual Score - Expected Score)
```

Where:
- **Actual Score** = 1 for win, 0 for loss, 0.5 for draw
- **Expected Score** = probability of winning (0 to 1)
- **K** = K-factor (determines how much ratings can change)

### Example

If you're rated 1500 and face someone rated 1700:
- Your expected score = 1 / (1 + 10^((1700-1500)/400)) = 0.24 (24% chance to win)
- Their expected score = 0.76 (76% chance to win)

If you WIN (upset!):
- Your rating change = K × (1 - 0.24) = K × 0.76 (big gain!)
- Their rating change = K × (0 - 0.76) = K × -0.76 (big loss!)

If you LOSE (as expected):
- Your rating change = K × (0 - 0.24) = K × -0.24 (small loss)
- Their rating change = K × (1 - 0.76) = K × 0.24 (small gain)

## Tuning Variables

### 1. **K-Factor** (Most Important)
Controls how volatile ratings are.

**Higher K** (e.g., 40):
- Ratings change quickly
- More responsive to recent performance
- More volatile, can swing wildly
- Good for: New players, small sample sizes

**Lower K** (e.g., 16):
- Ratings change slowly
- More stable over time
- Takes longer to reflect true skill
- Good for: Established players, large datasets

**Common approaches:**
- Chess: K=40 for beginners, K=20 for established, K=10 for masters
- Constant K: Use same value for everyone
- Dynamic K: Decrease K as player gains more matches

### 2. **Starting Rating**
Where new players begin (typically 1000, 1200, or 1500).

**Considerations:**
- Middle of pack (1500): New players face balanced competition
- Low start (1000): New players must "prove themselves"
- Average of existing players: Most fair for established system

### 3. **Scaling Factor** (400 in standard ELO)
Controls rating difference interpretation.

Standard: 400 means a 200-point difference = ~75% win probability

**Usually don't change this** - it's standardized for comparison across systems.

### 4. **Score Margin Integration**
Standard ELO only cares about win/loss. You can modify it to consider margin of victory.

**Option A: Margin Multiplier**
```
Rating Change = K × Margin_Multiplier × (Actual - Expected)
Margin_Multiplier = log(|Score Difference| + 1)
```

**Option B: Adjusted Actual Score**
Instead of 1/0, use a gradient:
```
Actual Score = 0.5 + (Your_Score - Their_Score) / (2 × Max_Score)
```
For 5-2 win: Actual = 0.5 + (5-2)/(2×5) = 0.8
For 5-4 win: Actual = 0.5 + (5-4)/(2×10) = 0.55

### 5. **Match Weight/Importance**
Multiply K by a weight factor for more important matches.

```
Effective K = Base K × Importance Weight
```

## Recommendations for Your Fencing System

### Starting Parameters
```
Base K-Factor: 32 (moderate volatility)
Starting Rating: 1500 (middle of scale)
Scaling Factor: 400 (standard)
```

### Poule Matches

**Use margin-adjusted actual scores:**
```
Actual Score = 0.5 + (Your_Touches - Their_Touches) / 10

Examples:
5-0 win → 1.0 (dominant)
5-2 win → 0.8 (comfortable)
5-4 win → 0.6 (close)
4-5 loss → 0.4 (close loss)
```

**Rationale:**
- Poules have scores to 5, giving granular performance data
- Close matches (5-4) should change ratings less than blowouts (5-0)
- This captures "quality" of performance, not just result

### DE Matches

**Use binary win/loss (1 or 0) with importance weighting:**

```
Importance Weight by Bracket Size:
L1-2    (Final):        3.0× (most important)
L1-4    (Semis):        2.5×
L1-8    (Quarters):     2.0×
L1-16:                  1.5×
L1-32:                  1.0× (baseline)

L3-4:                   2.0× (bronze medal match)
L5-8:                   1.5×
L9-16:                  1.0×
L17-32:                 0.7× (less weight, more casual)
```

**Rationale:**
- Finals matter more: higher stakes, more effort, better indicator of skill
- Lower brackets (L17-32) may have less engaged fencers or consolation matches
- No score data in DEs, so use binary outcome but weight by importance
- Top-bracket matches (L1-X) weighted higher than same-size lower brackets (L17-24)

### Alternative: Bracket-Level Weighting

Instead of individual match importance, could weight by "highest bracket reached":

```
After each tournament:
- Apply standard ELO for all matches
- Bonus adjustment based on final placement bracket:
  
  Win (1st):     +50 rating
  L2 (2nd):      +30 rating
  L4 (3rd-4th):  +15 rating
  L8 (5th-8th):  +5 rating
  L16/L32:       +0 rating
```

This rewards tournament success beyond individual match results.

### Handling Tournament Structure

**Process chronologically within each tournament:**
1. All poule matches first (update ratings after each match)
2. Then DE bracket matches in round order
3. Carry ratings forward to next tournament

**Issue to consider:** Poules are round-robin (everyone faces everyone), while DEs are elimination (winners face winners). This means:
- Strong fencers face each other more in DEs
- Weak fencers may never face strong fencers in DEs
- Poules provide better cross-skill-level data

**Recommendation:** Weight poules slightly higher or use them as the "true" rating, with DEs as a bonus/penalty.

### Suggested Final System

**For Poules:**
```
K = 32
Actual Score = 0.5 + (Your_Score - Their_Score) / 10
Expected Score = 1 / (1 + 10^((Opp_Rating - Your_Rating) / 400))
Rating Change = K × (Actual - Expected)
```

**For DEs:**
```
K = 32 × Bracket_Weight
Actual Score = 1 (win) or 0 (loss)
Expected Score = 1 / (1 + 10^((Opp_Rating - Your_Rating) / 400))
Rating Change = K × (Actual - Expected)

Bracket Weights:
- Top brackets (L1-2, L1-4, L1-8): 2.0-3.0×
- Mid brackets (L9-16, L5-8): 1.0-1.5×
- Lower brackets (L17-32): 0.7×
```

### Additional Considerations

**Initial Rating Bootstrap:**
Could set initial ratings based on average placement:
```
Average Placement 1-4:   Start at 1700
Average Placement 5-12:  Start at 1500
Average Placement 13-32: Start at 1300
```

**Rating Floor:**
Set a minimum rating (e.g., 800) so players don't go negative or too low.

**Rating Decay:**
If fencers take long breaks, could decay ratings toward mean:
```
After 6 months absence: Rating = 0.95 × Rating + 0.05 × 1500
```

**Separate Poule/DE Ratings:**
Could maintain two ratings:
- Poule ELO (5-touch fencing skill)
- DE ELO (elimination bracket performance)

This captures that some fencers are better in round-robin vs elimination formats.

## Testing the System

After implementation, validate by checking:

1. **Do top-rated players win more?** (Should be ~70-80%)
2. **Are ratings stable over time?** (Not bouncing wildly)
3. **Do new fencers' ratings converge quickly?** (Within 5-10 tournaments)
4. **Do upset wins properly reward?** (Big swings for unexpected outcomes)
5. **Does final ranking correlate with placement/win rate?** (Sanity check)

Start with conservative values (K=32, moderate weights) and adjust based on observed behavior.

## Field Size Considerations

### The Problem

A finals match (L1-2) means different things based on tournament size:
- **28 fencers**: You beat ~27 people to reach the final
- **12 fencers**: You beat ~11 people to reach the final

The same bracket label (L1-2) represents different levels of achievement. We should scale importance by field size.

### Approach 1: Direct Proportional Scaling

**Concept**: Scale importance by what fraction of the field remains.

```
Field_Size_Multiplier = (Total_Fencers / Bracket_Size)

Example - Finals (L1-2) with 28 fencers:
Base Weight = 3.0
Field Multiplier = 28 / 2 = 14
Effective Weight = 3.0 × sqrt(14) = 3.0 × 3.74 = 11.2

Example - Finals (L1-2) with 12 fencers:
Field Multiplier = 12 / 2 = 6
Effective Weight = 3.0 × sqrt(6) = 3.0 × 2.45 = 7.35
```

**Use square root** to prevent extreme scaling (linear would make 28-fencer finals weight 14× more than baseline, which is too much).

### Approach 2: Logarithmic Scaling

**Concept**: Weight increases with log of field size (diminishing returns for larger fields).

```
Field_Size_Multiplier = 1 + log2(Total_Fencers / Bracket_Size)

Example - Finals with 28 fencers:
Multiplier = 1 + log2(28/2) = 1 + log2(14) = 1 + 3.81 = 4.81
Effective Weight = 3.0 × 4.81 = 14.4

Example - Finals with 12 fencers:
Multiplier = 1 + log2(12/2) = 1 + log2(6) = 1 + 2.58 = 3.58
Effective Weight = 3.0 × 3.58 = 10.7
```

This grows slower than square root but still rewards larger fields significantly.

### Approach 3: Rounds-to-Win Scaling

**Concept**: Weight by number of rounds won to reach this match.

For a 28-fencer tournament:
- L1-2: Won 5 rounds to reach final → Weight × 5
- L17-32: In first DE round → Weight × 1

For a 12-fencer tournament:
- L1-2: Won 4 rounds → Weight × 4
- L9-12: In second round → Weight × 2

```
Rounds_Won = log2(Total_Fencers) - log2(Bracket_Size)
Field_Multiplier = Rounds_Won

Example - Finals with 28 fencers:
Rounds = log2(28) - log2(2) ≈ 4.8 - 1 = 3.8 rounds
Base Weight × 3.8

Example - Finals with 12 fencers:
Rounds = log2(12) - log2(2) ≈ 3.6 - 1 = 2.6 rounds
Base Weight × 2.6
```

**Problem**: Not truly rounds (28 isn't a power of 2), but captures the concept.

### Approach 4: Percentile-Based Weighting

**Concept**: Weight by what percentile of fencers you're beating.

```
Percentile = (Total_Fencers - Bracket_Upper_Bound) / Total_Fencers

Example - Finals (L1-2) with 28 fencers:
You're in top 2 out of 28
Percentile = (28 - 2) / 28 = 0.93 (93rd percentile)
Field_Multiplier = Percentile × Some_Scale

Example - L17-24 with 28 fencers:
You're in 17-24 range (let's say 20th place)
Percentile = (28 - 24) / 28 = 0.14 (14th percentile)
Field_Multiplier = much lower
```

This naturally handles different field sizes since percentiles are comparable.

### Recommended Hybrid Approach

**Combine bracket-based weights with field-size scaling:**

```python
def calculate_match_importance(bracket_name, total_fencers):
    # Base importance by bracket type
    base_weights = {
        'L1-2': 3.0,
        'L1-4': 2.5,
        'L1-8': 2.0,
        'L1-16': 1.5,
        'L1-32': 1.0,
    }
    
    # Extract bracket size (e.g., "L1-16" → 16)
    bracket_size = extract_bracket_size(bracket_name)
    
    # Field size multiplier (square root scaling)
    # Normalized to 24 fencers (typical field)
    field_multiplier = sqrt(total_fencers / bracket_size) / sqrt(24 / bracket_size)
    
    # Or simpler: just scale by sqrt of field proportion
    field_multiplier = sqrt(total_fencers / 24)
    
    return base_weights.get(bracket_name, 1.0) × field_multiplier
```

### Practical Examples

Using **sqrt(field_size / 24)** as multiplier:

| Bracket | 12 Fencers | 24 Fencers | 28 Fencers |
|---------|------------|------------|------------|
| **L1-2** (base 3.0) | 3.0 × 0.71 = **2.1** | 3.0 × 1.0 = **3.0** | 3.0 × 1.08 = **3.24** |
| **L1-8** (base 2.0) | 2.0 × 0.71 = **1.4** | 2.0 × 1.0 = **2.0** | 2.0 × 1.08 = **2.16** |
| **L17-24** (base 0.7) | N/A | 0.7 × 1.0 = **0.7** | 0.7 × 1.08 = **0.76** |

This gives:
- **Modest scaling**: 28-fencer finals ~8% more important than 24-fencer
- **Consistent ratios**: Finals always ~1.5× more important than L1-8 within same tournament
- **Fair adjustment**: Smaller tournaments don't get overly penalized

### Alternative: Logarithmic Field Scaling

If you want **more dramatic** differences:

```python
field_multiplier = log2(total_fencers) / log2(24)
```

| Bracket | 12 Fencers | 24 Fencers | 28 Fencers |
|---------|------------|------------|------------|
| **L1-2** (base 3.0) | 3.0 × 0.77 = **2.3** | 3.0 × 1.0 = **3.0** | 3.0 × 1.04 = **3.12** |

This gives less dramatic scaling than sqrt but still rewards larger fields.

### Recommendation

**Use sqrt scaling**: `sqrt(total_fencers / 24)`
- Simple to understand
- Moderate scaling (not too extreme)
- Rewards larger tournaments but doesn't over-penalize small ones
- Can adjust the baseline (24) based on your typical tournament size

**Track field size per tournament** in the data and apply this multiplier to all DE matches from that tournament.

### Implementation Note

You'll need to track tournament size. Options:
1. Count unique fencers who participated in that date's tournament
2. Extract from DE sheet (highest seed number)
3. Manual annotation in google_sheets_links.txt

Most robust: Count unique fencers in poules + DEs for that date.

## Summary: Recommended Starting Point (Updated with Actual Data)

### Observed Tournament Characteristics

Based on 41 sessions of actual data:
- **Average field size**: 20.2 fencers in poules, 18.1 in DEs (89.5% participation)
- **Typical range**: 11-29 fencers per tournament
- **Match volume**: ~83 poule matches, ~35 DE matches per session
- **Score distribution**: 
  - Close matches (5-3, 5-4): **59.1%** of all poule matches
  - Moderate wins (5-2): 21.2%
  - Dominant wins (5-0, 5-1): 18.4%
- **Competitive spread**: 
  - Top fencers: 67-83% winrate (Alejo, Eric L, Greg, Garen)
  - Mid-tier: 40-60% winrate
  - Developing: 15-35% winrate
  - Winrate range among active fencers: ~70 percentage points

### Key Insight: High Competitive Variance

This league shows **significant skill stratification**. The top tier (Greg at 82.6%, Garen at 79.5%) has a massive edge over mid-tier fencers. Combined with:
- Small field sizes (often 12-20 fencers)
- High frequency (weekly tournaments)
- Same core group competing repeatedly

This means:
1. Ratings should converge **quickly** (higher K)
2. Matches are **predictable** for established players (need rating spread)
3. Most matches are **close** even between skill levels (60% are 5-3 or 5-4)

### Updated Recommendations (FINAL - TUNED)

After testing with actual data and iterating on parameters:

```python
# Base parameters
BASE_K = 40  # INCREASED from 32 - faster convergence for frequent players
STARTING_RATING = 1400  # LOWERED from 1500 - most fencers below average
RATING_FLOOR = 600  # LOWERED from 800 - allow full range
RATING_CEILING = 2200  # NEW - prevent runaway ratings

# Minimum matches for established rating
MIN_MATCHES_FOR_ESTABLISHED = 30  # Below this = provisional rating

# K-factor scaling by experience (TUNED)
def get_k_factor(num_matches):
    """Dynamic K that decreases with experience."""
    if num_matches < 20:
        return 50  # New players: converge very fast
    elif num_matches < 50:
        return 45  # Developing: still adapting (INCREASED from 40)
    elif num_matches < 150:
        return 40  # Established: moderate changes (INCREASED from 32)
    else:
        return 32  # Veterans (150+ matches): stable (INCREASED from 24)

# Poule settings
USE_MARGIN = True  # Use touch differential

def calculate_poule_actual_score(your_score, their_score):
    """
    Margin-adjusted actual score for poules.
    Updated to handle the fact that 60% of matches are close (5-3, 5-4).
    """
    # Standard formula
    actual = 0.5 + (your_score - their_score) / 10
    
    # Examples:
    # 5-0: 1.0 (dominant)
    # 5-1: 0.9 (very strong)
    # 5-2: 0.8 (comfortable)
    # 5-3: 0.7 (solid)
    # 5-4: 0.6 (close)
    # 4-5: 0.4 (close loss)
    return actual

# DE bracket importance weights (TUNED for better spread)
BRACKET_WEIGHTS = {
    # Top brackets (fighting for podium) - SIGNIFICANTLY INCREASED
    'L1-2': 5.0,    # Finals (was 4.0)
    'L1-4': 4.0,    # Semifinals (was 3.0)
    'L1-8': 3.0,    # Quarterfinals (was 2.5)
    'L1-16': 2.5,   # (was 2.0)
    'L1-32': 2.0,   # (was 1.5)
    
    # Medal matches
    'L3-4': 4.0,    # Bronze match (was 3.0)
    
    # Mid-tier brackets
    'L5-8': 2.5,    # (was 2.0)
    'L9-16': 2.0,   # (was 1.5)
    'L9-12': 2.0,   # (was 1.5)
    'L13-16': 1.8,  # (was 1.3)
    
    # Lower brackets (consolation rounds)
    'L17-32': 1.2,  # (was 1.0)
    'L17-24': 1.2,  # (was 1.0)
    'L25-32': 1.0,  # (was 0.8)
}

# Field size scaling
def get_field_size_multiplier(total_fencers):
    """
    Scale importance by field size.
    Based on observed range: 11-29 fencers, average 20.
    """
    # Use sqrt scaling normalized to 20 fencers
    return (total_fencers / 20) ** 0.5

# Winner bonus (TUNED DOWN to prevent single-tournament spikes)
PLACEMENT_BONUSES = {
    1: 15,   # Winner bonus (reduced from 25)
    2: 10,   # Runner-up bonus (reduced from 15)
    3: 5,    # Third/fourth place bonus (reduced from 8)
    4: 5,
}
```

### Rationale for Changes

**Higher K-factor (32→40, with dynamic scaling):**
- Weekly tournaments = lots of data quickly
- Small fields = repeated matchups between same fencers
- Need fast convergence to reflect actual skill levels
- Dynamic K prevents veteran ratings from ossifying

**Lower starting rating (1500→1400):**
- Data shows most fencers cluster below 50% winrate
- Top tier is genuinely exceptional (Greg: 82.6% over 477 matches!)
- Starting at 1400 allows new fencers to rise OR fall appropriately
- Creates more room at top for elite performers

**Increased bracket weights:**
- With small fields (often 12-20), making the finals is a bigger achievement
- L1-2 in a 20-person tournament = beat 19 others
- Higher stakes in top brackets should have proportionally more impact

**Winner bonus (NEW):**
- Winning a tournament is psychologically and competitively significant
- Provides additional reward beyond individual match ELO
- Helps differentiate consistent finalists from occasional winners
- Applied after all match-based ELO updates for that session

**Dynamic K-factor (NEW):**
- New fencers (< 20 matches): K=50 (rapid convergence)
- Developing (20-50 matches): K=40 (still learning)
- Established (50-150 matches): K=32 (stable but responsive)
- Veterans (150+ matches): K=24 (resistant to noise)
- Reflects that players with 200+ matches have proven their level

### Expected Rating Distribution

With these parameters, expect:
- **Elite tier (1800-2000+)**: Greg, Garen, Eric L, Rudi (top ~5%)
- **Strong competitors (1600-1800)**: Alejo, Sameer, Fassel, Alex Y, Charlie (~15%)
- **Mid-tier (1400-1600)**: Solid regular competitors (~40%)
- **Developing (1200-1400)**: Newer or inconsistent fencers (~30%)
- **Beginners (< 1200)**: Very new or struggling fencers (~10%)

This spread (roughly 800 rating points from bottom to top) aligns well with the observed ~70 percentage point winrate spread.

### Testing Checklist

After implementation, validate:

1. **Do top fencers reach 1800+?** (Greg, Garen should be highest)
2. **Rating stability**: Do veteran ratings stabilize after ~10 sessions?
3. **Predictive power**: Does higher ELO predict wins ~70-80% of the time?
4. **New fencer convergence**: Do ratings stabilize within 5-10 tournaments?
5. **Upset rewards**: Do lower-rated winners get significant boosts?
6. **Final ranking correlation**: Do ELO rankings match observed placement stats?

If ratings seem too volatile: decrease K
If ratings seem too compressed: increase bracket weights or K
If new fencers don't converge: increase initial K
If top fencers aren't differentiated: add more winner bonus or increase top bracket weights
