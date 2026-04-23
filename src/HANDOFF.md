# Fencing Tournament ELO Rating System - Complete Handoff

**Project**: Haverstock Fencing Club Tournament Analysis  
**Date**: 2026-04-23  
**Status**: Complete and Production Ready  

---

## Table of Contents
1. [Overview](#overview)
2. [What We Built](#what-we-built)
3. [System Architecture](#system-architecture)
4. [ELO Configuration Parameters](#elo-configuration-parameters)
5. [How the System Works](#how-the-system-works)
6. [File Structure](#file-structure)
7. [Running the System](#running-the-system)
8. [Output Files](#output-files)
9. [Tuning the System](#tuning-the-system)
10. [Key Design Decisions](#key-design-decisions)
11. [Results and Validation](#results-and-validation)
12. [Future Improvements](#future-improvements)

---

## Overview

This system processes fencing tournament data from Google Sheets, tracks match history, calculates comprehensive statistics, and implements a tuned ELO rating system to rank fencer skill levels.

**Key Features:**
- Downloads tournament data from Google Sheets automatically
- Parses both poule (round-robin) and DE (direct elimination) matches
- Tracks complete match history with head-to-head records
- Implements ELO rating system with margin-adjusted scoring
- Generates 8 output files with different views of the data
- Processes 41 tournaments, 4,794 matches, 132 fencers

---

## What We Built

### Core Functionality
1. **Google Sheets Downloader** (`download_sheets.py`)
   - Reads URLs from `google_sheets_links.txt`
   - Downloads main sheet (poule results) as CSV
   - Downloads "DE" tab (elimination bracket) as separate CSV
   - Organizes by date folders

2. **Match History Tracker** (`track_match_history.py`)
   - Parses poule matrices (round-robin format)
   - Parses DE brackets (spatial layout, consecutive row pairs)
   - Tracks all matches between fencer pairs
   - Calculates comprehensive statistics
   - Implements ELO rating system

3. **ELO Rating System**
   - Dynamic K-factors based on experience
   - Margin-adjusted scoring for poules
   - Bracket importance weighting for DEs
   - Field size scaling
   - Placement bonuses
   - Provisional ratings for new fencers

---

## System Architecture

```
fencing thing/
├── google_sheets_links.txt       # List of tournament URLs
├── download_sheets.py             # Download script
├── track_match_history.py         # Main analysis + ELO system
├── ELO_SYSTEM_DESIGN.md          # Complete ELO documentation
├── README.md                      # User-facing guide
├── HOW_TO_READ_THE_DATA.txt      # Explains bracket system
├── downloaded_sheets/             # Raw data from Google Sheets
│   ├── 2025-05-06/
│   │   ├── <sheet-id>.csv        # Poule results
│   │   └── <sheet-id>_DE.csv     # DE bracket
│   └── ... (41 tournament folders)
└── outputs/                       # All generated files
    ├── elo_ratings.csv
    ├── elo_history.csv
    ├── elo_history_example.txt
    ├── ELO_SUMMARY.txt
    ├── fencer_stats.csv
    ├── head_to_head_stats.csv
    ├── match_history.csv
    ├── placement_stats.csv
    ├── session_stats.csv
    └── global_stats.txt
```

---

## ELO Configuration Parameters

All parameters are **global variables** at the top of `track_match_history.py` (lines 13-61).

### Core Parameters
```python
BASE_K = 40                    # Base K-factor (volatility)
STARTING_RATING = 1400         # New fencer initial rating
RATING_FLOOR = 600             # Minimum rating
RATING_CEILING = 2200          # Maximum rating
ELO_SCALING_FACTOR = 400       # Standard ELO scaling (don't change)
```

### Experience-Based K-Factors
```python
K_FACTOR_THRESHOLDS = {
    0: 50,      # New players (0-19 matches): fast convergence
    20: 45,     # Developing (20-49 matches): still adapting
    50: 40,     # Established (50-149 matches): moderate changes
    150: 32     # Veterans (150+ matches): stable ratings
}

MIN_MATCHES_FOR_ESTABLISHED = 30  # Below this = "Provisional" status
```

### Margin Scoring (Poules)
```python
USE_MARGIN_SCORING = True

# Formula: Actual Score = 0.5 + (Your_Score - Their_Score) / 10
# Examples:
#   5-0 → 1.0 (dominant)
#   5-2 → 0.8 (comfortable)
#   5-4 → 0.6 (close)
```

### DE Bracket Weights
```python
BRACKET_WEIGHTS = {
    # Top brackets (multiplier on K)
    'L1-2': 5.0,    # Finals
    'L1-4': 4.0,    # Semifinals
    'L1-8': 3.0,    # Quarterfinals
    'L1-16': 2.5,
    'L1-32': 2.0,
    'L3-4': 4.0,    # Bronze medal
    
    # Mid-tier
    'L5-8': 2.5,
    'L9-16': 2.0,
    'L9-12': 2.0,
    'L13-16': 1.8,
    
    # Lower brackets
    'L17-32': 1.2,
    'L17-24': 1.2,
    'L25-32': 1.0,
}
```

### Field Size Scaling
```python
FIELD_SIZE_BASELINE = 20               # Average tournament size
FIELD_SIZE_SCALING_EXPONENT = 0.5      # 0.5 = sqrt, 1.0 = linear

# Formula: multiplier = (total_fencers / 20) ^ 0.5
# Adjusts for tournament size (observed range: 11-29 fencers)
```

### Placement Bonuses
```python
PLACEMENT_BONUSES = {
    1: 15,   # Winner bonus (flat adjustment after tournament)
    2: 10,   # Runner-up
    3: 5,    # Third place
    4: 5,    # Fourth place
}
```

---

## How the System Works

### 1. Data Collection
```bash
python3 download_sheets.py
```
- Reads `google_sheets_links.txt`
- Downloads each sheet as CSV
- Saves to `downloaded_sheets/YYYY-MM-DD/`

### 2. Processing Flow

**Chronological Processing:**
```
For each tournament (in date order):
  1. Parse poule matches (round-robin matrix)
     - Process upper triangle only (avoid duplicates)
     - Randomize order (date-seeded) to prevent bias
     - Extract scores from both fencer perspectives
  
  2. Process ELO for poule matches
     - Calculate expected scores
     - Apply margin-adjusted actual scores
     - Update ratings with base K-factor
  
  3. Parse DE matches (bracket layout)
     - Process consecutive row pairs as matchups
     - Extract bracket levels (L1-2, L1-8, etc.)
     - Determine winners from 'V' indicators
  
  4. Process ELO for DE matches
     - Apply bracket weight multiplier
     - Apply field size multiplier
     - Update ratings
  
  5. Apply placement bonuses
     - Add flat bonus for top 4 finishers
  
  6. Calculate session statistics
```

### 3. ELO Calculation Details

**Expected Score Formula:**
```python
expected = 1 / (1 + 10^((opponent_rating - your_rating) / 400))
```

**Rating Change Formula:**
```python
# For poules:
K = get_k_factor(num_matches)
actual = 0.5 + (your_score - their_score) / 10
change = K * (actual - expected)

# For DEs:
K_effective = K * bracket_weight * field_multiplier
actual = 1.0 if won else 0.0
change = K_effective * (actual - expected)
```

**Rating Bounds:**
```python
new_rating = max(RATING_FLOOR, min(RATING_CEILING, old_rating + change))
```

### 4. Key Behaviors

**Winners Can Lose Rating:**
- If a highly-rated fencer barely beats a weak opponent
- Example: Greg (1839) beats Tom S (1317) only 5-4 → Greg loses 11.3 points
- This is correct ELO behavior with margin-adjusted scoring

**Asymmetric Changes:**
- Winners and losers can have different K-factors
- Upsets create larger swings
- Example: Alejo (1696) upsets Sammy (1790) → Alejo gains 113, Sammy loses 141

**Poule Match Ordering:**
- Unknown chronological order within poule
- Randomized with date-based seed (reproducible)
- Prevents systematic bias from matrix position

---

## File Structure

### Input Files

**`google_sheets_links.txt`**
```
Format: M/D/YY,URL
Example: 5/6/25,https://docs.google.com/spreadsheets/d/...
```

**Poule Sheet CSV** (round-robin matrix)
```
Row 0: Header with fencer names
Row 1: Numbers
Row 2+: Each fencer's row with results
  - 'V' = won (5-X)
  - '0-4' = lost (X-5)
  - Upper triangle processed to avoid duplicates
```

**DE Sheet CSV** (bracket layout)
```
Column 0: Seed (from poules)
Column 1: Fencer name
Column 3-4: L1-32 round
Column 5-6: L1-16 round
Column 7-8: L1-8 round
Column 9-10: Semifinals
Column 11-12: Finals
Column 13: Winner (final placement)

Consecutive row pairs = matchups
'V' in result column = winner
```

### Source Code

**`track_match_history.py`** (1,400+ lines)
- Lines 13-61: ELO configuration (ALL TUNABLE PARAMETERS)
- Lines 63-199: ELO calculation functions
- Lines 201-278: ELORatingSystem class
- Lines 280-423: MatchHistory class
- Lines 446-554: Poule parsing
- Lines 557-656: DE parsing
- Lines 659-701: Session stats calculation
- Lines 703-797: Main processing loop with ELO
- Lines 800-1,200: Export functions
- Lines 1,330-1,368: Main entry point

**`download_sheets.py`** (136 lines)
- Simple downloader for Google Sheets
- Downloads both main sheet and DE tab

---

## Running the System

### Initial Setup
```bash
# Install dependencies
pip install pandas openpyxl

# Download tournament data
python3 download_sheets.py
```

### Generate All Statistics
```bash
python3 track_match_history.py
```

**Output:**
```
Processing all fencing sheets with ELO rating system...

ELO Configuration:
  Base K-Factor: 40
  Starting Rating: 1400
  Rating Range: 600 - 2200
  Margin Scoring: True
  Field Size Baseline: 20

Processing 2025-05-06...
  Found 112 poule matches
  Found 48 DE matches
  Found 23 placements
...
[41 tournaments processed]

✓ Match history exported to outputs/match_history.csv
✓ Placement statistics exported to outputs/placement_stats.csv
✓ Fencer statistics exported to outputs/fencer_stats.csv
✓ Head-to-head statistics exported to outputs/head_to_head_stats.csv
✓ Session statistics exported to outputs/session_stats.csv
✓ Global statistics exported to outputs/global_stats.txt
✓ ELO ratings exported to outputs/elo_ratings.csv
✓ ELO history exported to outputs/elo_history.csv
```

---

## Output Files

### 1. `elo_ratings.csv` - Final Rankings
**132 fencers, sorted by skill level**

Columns:
- Fencer name
- Final ELO rating
- Total matches played
- Current K-factor
- Status (Established or Provisional)

**Top 5:**
1. Greg - 1972.5 (477 matches, Established)
2. Fassel - 1832.0 (96 matches, Established)
3. Fessal - 1698.4 (59 matches, Established)
4. Alex Y - 1686.4 (239 matches, Established)
5. Eric L - 1678.5 (331 matches, Established)

**Rating Distribution:**
- Elite (1800+): 2 fencers (3.1%)
- Strong (1600-1800): 8 fencers (12.3%)
- Solid (1400-1600): 30 fencers (46.2%)
- Developing (1200-1400): 22 fencers (33.8%)
- Beginner (<1200): 3 fencers (4.6%)

### 2. `elo_history.csv` - Complete Match History
**4,794 match records, chronologically ordered**

Columns:
- Date
- Match Type (Poule, L1-2, L1-8, etc.)
- Result: (W) Winner Score-Score Loser
- Winner name, old rating, new rating, change
- Loser name, old rating, new rating, change

**Key Feature:** Winner always in columns 4-7, Loser in columns 8-11

Example:
```
2026-04-21, L1-2, (W) Greg - Alex Y, Greg, 1910.1, 1957.5, +47.4, Alex Y, 1723.8, 1676.4, -47.4
```

### 3. `fencer_stats.csv` - Individual Performance
**Comprehensive stats for each fencer**

Includes:
- Total appearances and matches
- Win/loss records (overall, poule-only, DE-only)
- Win rates
- Touch differential
- Average seeding and placement
- Placement breakdown (Win, L2, L4, L8, L16, L32)

### 4. `head_to_head_stats.csv` - Matchup Records
**All fencer pairs who have faced each other**

Includes:
- Win records for each fencer in the matchup
- Poule vs DE breakdown
- Touch statistics
- Date range of matches

### 5. `match_history.csv` - Raw Match Data
**Every match with duplicated perspectives**

Each match appears twice (once for each fencer) for easy filtering.

### 6. `placement_stats.csv` - Tournament Placements
**How often fencers place in each bracket**

Shows counts for Win, L2, L4, L8, L16, L32 with detailed placement breakdowns.

### 7. `session_stats.csv` - Per-Tournament Stats
**41 rows, one per tournament**

Columns:
- Date
- Winner
- Fencers in poules/DEs
- Total/poule/DE match counts
- Score distribution (5-0, 5-1, 5-2, 5-3, 5-4)
- Touch statistics

### 8. `global_stats.txt` - Overall Summary
**League-wide statistics in readable format**

Includes:
- Total sessions, matches, fencers
- Averages (fencers, matches, touches per session)
- Score distribution
- DE participation rate

---

## Tuning the System

### To Increase Rating Spread
Make top players separate more from mid-tier:

```python
# Option 1: Increase bracket weights
BRACKET_WEIGHTS['L1-2'] = 6.0  # was 5.0
BRACKET_WEIGHTS['L1-4'] = 5.0  # was 4.0

# Option 2: Increase base K
BASE_K = 45  # was 40

# Option 3: Increase placement bonuses
PLACEMENT_BONUSES[1] = 20  # was 15
```

### To Decrease Rating Volatility
Make ratings more stable:

```python
# Option 1: Lower K-factors across the board
K_FACTOR_THRESHOLDS = {
    0: 40,    # was 50
    20: 35,   # was 45
    50: 30,   # was 40
    150: 24   # was 32
}

# Option 2: Decrease bracket weights
BRACKET_WEIGHTS['L1-2'] = 4.0  # was 5.0

# Option 3: Reduce margin sensitivity
# Change formula in calculate_poule_actual_score()
return 0.5 + (your_score - their_score) / 15  # was 10
```

### To Change New Player Convergence
Adjust how quickly new players reach true rating:

```python
# Faster convergence
K_FACTOR_THRESHOLDS[0] = 60  # was 50

# Slower convergence
K_FACTOR_THRESHOLDS[0] = 40  # was 50

# Longer provisional period
MIN_MATCHES_FOR_ESTABLISHED = 50  # was 30
```

### To Disable Margin Scoring
Make all poule matches binary (win/loss only):

```python
USE_MARGIN_SCORING = False
```

### Testing Changes
After modifying parameters:
1. Delete `outputs/` directory
2. Run `python3 track_match_history.py`
3. Check `elo_ratings.csv` for rating spread
4. Check `elo_history.csv` for typical match changes
5. Validate against expected behavior

---

## Key Design Decisions

### 1. Margin-Adjusted Scoring for Poules
**Decision:** Use touch differential, not just win/loss  
**Rationale:** 
- 60% of poule matches are close (5-3 or 5-4)
- Close wins should change ratings less than blowouts
- Rewards dominant performances
- Penalizes narrow wins by favorites

**Impact:**
- Winners can lose rating if they underperform
- Creates more accurate skill assessments
- Greg (1839) loses 11 points for 5-4 win over Tom S (1317)

### 2. High Bracket Weights for DEs
**Decision:** Finals have 5.0× multiplier  
**Rationale:**
- Small field sizes (12-20 fencers)
- Reaching finals is a major achievement
- Creates rating spread between skill tiers
- Tournament success should be heavily rewarded

**Impact:**
- Finals swings: 50-150 point changes
- Greg climbed from 1400 → 1972 over 477 matches
- Clear separation: Elite (1800+) vs Strong (1600-1800)

### 3. Dynamic K-Factors by Experience
**Decision:** K decreases as fencer gains experience  
**Rationale:**
- New players: ratings uncertain, need fast convergence
- Veterans: ratings stable, need consistency
- Prevents established ratings from wild swings

**Impact:**
- New fencers (K=50) reach true rating in 10-15 tournaments
- Veterans (K=32) have stable ratings
- Provisional status until 30 matches

### 4. Lower Starting Rating (1400)
**Decision:** Start below average, not at average  
**Rationale:**
- Most fencers cluster below 50% winrate
- Top tier is genuinely exceptional
- Creates room at top for elite performers

**Impact:**
- Greg at 1972 stands out
- Mid-tier around 1400-1600 as intended
- New fencers typically rise or fall from 1400

### 5. Placement Bonuses
**Decision:** Small bonuses (15/10/5) for top 4  
**Rationale:**
- Tournament wins matter beyond match results
- Bonuses too large → single-tournament spikes
- Bonuses too small → finals matches are the only reward

**Impact:**
- Winning tournament = ~15 bonus + finals match (~50-100)
- Total boost: 65-115 points for winning
- Prevents "Fasal problem" (1 tournament, ranked #2)

### 6. Date-Seeded Randomization for Poules
**Decision:** Shuffle poule matches per tournament  
**Rationale:**
- True chronological order unknown
- Matrix order creates systematic bias
- Date-based seed ensures reproducibility

**Impact:**
- Each tournament has different processing order
- Same tournament always processes same way
- No systematic advantage to matrix position

### 7. Field Size Scaling
**Decision:** Use sqrt(field_size / 20)  
**Rationale:**
- 28-fencer finals ≠ 12-fencer finals
- Linear scaling too extreme
- Sqrt provides moderate adjustment

**Impact:**
- 28-fencer tournament: 8% higher weights
- 12-fencer tournament: 29% lower weights
- Fair comparison across tournament sizes

---

## Results and Validation

### Final ELO Distribution
```
Elite (1800+):        Greg (1972), Fassel (1832)
Strong (1600-1800):   8 fencers including Eric L, Alex Y, Fessal
Solid (1400-1600):    30 fencers (bulk of league)
Developing (1200-1400): 22 fencers
Beginner (<1200):     3 fencers
```

**Rating Spread:** 815 points (1972 → 1157)  
**Average (Established):** ~1450

### Validation Checks

✅ **Top fencers reach 1800+**  
Greg at 1972, Fassel at 1832

✅ **Rating spread reflects winrate variance**  
Greg 82.6% → 1972, Alejo 67.2% → 1517 (455 point gap)

✅ **Provisional ratings flagged**  
All fencers <30 matches marked "Provisional"

✅ **Chronological processing maintained**  
All 4,794 matches in elo_history.csv ordered by date

✅ **Upset rewards significant**  
Alejo (1696) upsets Sammy (1790) → +113 vs expected +47

✅ **Veterans have stable ratings**  
Greg's rating (477 matches, K=32) varies ±50 per tournament

✅ **Margin scoring works**  
Greg (1839) loses rating for narrow 5-4 win over Tom S (1317)

### Known Edge Cases

**1. Winners with negative rating changes**
- 52 instances in 4,794 matches (1.1%)
- All are highly-rated fencers barely beating weak opponents
- Correct ELO behavior with margin-adjusted scoring

**2. Asymmetric changes in upsets**
- Winner gains more than loser loses (or vice versa)
- Due to different K-factors based on experience
- Working as intended

**3. Duplicate names with trailing spaces**
- "Greg" vs "Greg " vs "greg"
- All normalized with `.strip().title()`
- Some duplicates remain in data (manual cleanup needed)

---

## Future Improvements

### Potential Enhancements

1. **True Chronological Poule Order**
   - Requires timestamped match data
   - Would improve accuracy of ELO calculations
   - Currently using date-seeded randomization

2. **Separate Poule/DE Ratings**
   - Some fencers better in round-robin vs elimination
   - Could maintain dual ratings
   - More complex but more accurate

3. **Rating Decay for Inactivity**
   - Fencers who don't compete for months
   - Decay toward mean: `new_rating = 0.95 * old + 0.05 * 1500`
   - Would reflect skill loss from inactivity

4. **Confidence Intervals**
   - Show rating uncertainty (e.g., "1500 ± 50")
   - Higher for provisional ratings
   - Lower for established ratings

5. **Rating History Visualization**
   - Graph each fencer's rating over time
   - Show tournament-by-tournament progression
   - Identify trends and plateaus

6. **Head-to-Head Predictions**
   - Given two fencers, predict match outcome
   - Show expected score and win probability
   - Use for tournament seeding

7. **Tournament Difficulty Adjustment**
   - Weight tournaments by average opponent strength
   - Harder tournaments count more
   - Prevents "farming" weak tournaments

8. **Name Deduplication**
   - Automated detection of similar names
   - Manual review and merge interface
   - Clean up "Greg" vs "Greg " issues

### Known Issues

1. **Trailing Spaces in Names**
   - Some fencers appear multiple times
   - Example: "Charlie" vs "Charlie "
   - Manual cleanup needed in source data

2. **Missing DE Data**
   - Some tournaments missing placement data
   - Falls back to "Unknown" winner
   - No impact on ELO (uses match results)

3. **Inconsistent Bracket Naming**
   - Some sheets use different format
   - Bracket weight matching is fuzzy
   - Works but could be more robust

---

## Technical Notes

### Dependencies
```
Python 3.7+
pandas
openpyxl
```

### Performance
- Processing time: ~3-5 seconds for 41 tournaments
- Memory usage: <100 MB
- Scales linearly with number of matches

### Data Validation
The system handles:
- Missing scores (marked as '?-5' or '5-?')
- Byes (marked as '_')
- Case-insensitive name matching
- Malformed CSV rows
- Missing DE sheets

### Git Safety
Important files to commit:
- `track_match_history.py` (main code)
- `download_sheets.py` (downloader)
- `google_sheets_links.txt` (tournament list)
- `ELO_SYSTEM_DESIGN.md` (documentation)
- `outputs/` (generated files for analysis)

Don't commit:
- `downloaded_sheets/` (large, regenerable)
- `__pycache__/` (Python cache)
- `.DS_Store` (macOS files)

---

## Quick Reference Card

### Common Tasks

**Add new tournament:**
```bash
# 1. Add URL to google_sheets_links.txt
echo "4/28/26,https://docs.google.com/spreadsheets/d/..." >> google_sheets_links.txt

# 2. Download it
python3 download_sheets.py

# 3. Regenerate all stats
python3 track_match_history.py
```

**Increase rating volatility:**
```python
# Edit track_match_history.py
BASE_K = 50  # was 40
BRACKET_WEIGHTS['L1-2'] = 6.0  # was 5.0
```

**Check specific fencer:**
```bash
grep "Greg" outputs/elo_ratings.csv
grep "Greg" outputs/fencer_stats.csv
```

**View match history for fencer:**
```bash
grep "Greg" outputs/elo_history.csv | head -20
```

**Find all finals matches:**
```bash
grep "L1-2" outputs/elo_history.csv
```

### File Locations

**Configuration:** Lines 13-61 of `track_match_history.py`  
**ELO logic:** Lines 63-199 of `track_match_history.py`  
**Main processing:** Lines 703-797 of `track_match_history.py`  
**Output directory:** `outputs/`  
**Raw data:** `downloaded_sheets/`

### Parameter Quick Tweaks

```python
# Make ratings change faster
BASE_K = 50

# Make ratings more stable
BASE_K = 30

# Increase finals impact
BRACKET_WEIGHTS['L1-2'] = 7.0

# Decrease finals impact
BRACKET_WEIGHTS['L1-2'] = 3.0

# Bigger winner bonuses
PLACEMENT_BONUSES[1] = 25

# Disable margin scoring
USE_MARGIN_SCORING = False
```

---

## Contact & References

**Documentation:**
- This file: `HANDOFF.md`
- ELO design: `ELO_SYSTEM_DESIGN.md`
- User guide: `README.md`
- Data explanation: `HOW_TO_READ_THE_DATA.txt`
- Example guide: `outputs/elo_history_example.txt`
- Results summary: `outputs/ELO_SUMMARY.txt`

**Key Conversation Topics:**
- Initial parsing of poule/DE formats
- Fixing duplicate match counting
- Implementing ELO system from scratch
- Tuning parameters based on actual data
- Handling provisional ratings
- Creating readable output formats

**Final State:**
- 41 tournaments processed
- 4,794 matches tracked
- 132 fencers rated
- 8 output files generated
- ELO system validated and tuned
- Documentation complete

---

## End of Handoff

This document contains everything needed to understand, maintain, and modify the fencing tournament analysis system. All code is production-ready and fully documented.

**Status:** ✅ Complete and Working  
**Last Updated:** 2026-04-23  
**Version:** 1.0 (Final)
