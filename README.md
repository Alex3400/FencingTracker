# Haverstock Fencing Elo Ratings

A data analysis tool that processes fencing tournament results and calculates Elo ratings for club members. The system reads CSV tournament sheets (both poule and direct elimination brackets) and generates a static website with leaderboards, fencer statistics, match history, and interactive visualizations.

Visit https://alex3400.github.io/FencingTracker/ to view the page online

## Overview

This project implements a customized Elo rating system for weekly fencing tournaments. It parses tournament data from CSV files, calculates ratings with margin-based scoring for poule matches and bracket-weighted scoring for DEs, then exports the results as both CSV files and JSON data that powers an interactive website.

**Live features:**
- Current leaderboard with sortable rankings
- Individual fencer statistics and performance history
- Head-to-head matchup analysis
- Interactive Elo timeline charts
- Tournament history with detailed match breakdowns
- Upset indicators showing unexpected results

## How It Works

### Data Flow
1. Tournament results are stored as CSV files in `downloaded_sheets/YYYY-MM-DD/`
2. `track_match_history.py` processes all sheets chronologically
3. Elo ratings are calculated with match-by-match updates
4. Results are exported to `src/outputs/` and `docs/data/`
5. Static website (`docs/`) displays the data with JavaScript visualizations

### Elo System Configuration

The system uses several modifications to the classic Elo formula:

- **Starting Rating:** 1800 for all new fencers
- **Dynamic K-Factor:** Ranges from 40 (new players, 0-19 matches) down to 25 (veterans, 150+ matches) to allow faster convergence for newcomers while stabilizing experienced fencers
- **Margin Scoring:** Poule matches use score-adjusted ratings (5-0 = 1.0, 5-4 = 0.72 for winner) so that close matches give partial credit to the loser
- **Bracket Weighting:** DE matches have importance multipliers (Finals 4.0x, Semi-finals 3.0x, Quarter-finals 2.0x, etc.) with field size scaling
- **Placement Bonuses:** Top finishers receive flat rating bonuses (1st: +25, 2nd: +15, 3rd/4th: +8/+5)
- **Inactivity Decay:** After 8 missed sessions, ratings above 1900 decay by 8% per session toward 1900

All configuration constants are defined at the top of `src/track_match_history.py` for easy tuning.

## Setup

### Prerequisites
- Python 3.7+
- Required packages: `matplotlib` (optional, for plotting)

### Installation

```bash
# Clone the repository
git clone https://github.com/Alex3400/FencingTracker.git
cd FencingTracker

# (Optional) Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies (matplotlib is optional)
pip install matplotlib
```

### Data Structure

Tournament data should be organized as:
```
downloaded_sheets/
  YYYY-MM-DD/
    SessionName.csv          # Poule sheet
    SessionName_DE.csv       # Direct elimination bracket
```

**Poule Sheet Format:** Matrix with fencer names in first row and column, results in cells (V for victory, 0-4 for loss score)

**DE Sheet Format:** Bracket structure with columns for each round (L32, L16, L8, Semi-final, Final), each pair of rows represents one match, V indicates winner

## Usage

### Processing Tournament Data

To update ratings with new tournament data:

```bash
cd src
python track_match_history.py
```

This will:
1. Process all tournament folders in `downloaded_sheets/` chronologically
2. Calculate Elo ratings for every match
3. Export CSV files to `src/outputs/` (ratings, history, stats, etc.)
4. Export JSON and CSV files to `docs/data/` (for the website)

**Output files:**
- `elo_ratings.csv` - Current ratings and match counts
- `elo_history.csv` - Complete match-by-match rating changes
- `fencer_stats.csv` - Comprehensive statistics per fencer
- `head_to_head_stats.csv` - All pairwise matchup records
- `session_stats.csv` - Per-tournament summary statistics
- `elo_timeline.json` - Rating snapshots after each session (for charts)
- `sessions.json` - Tournament history with placements

### Viewing the Website

After processing data, you can view the website locally:

```bash
# Navigate to the docs folder
cd docs

# Open index.html in your browser
# On macOS:
open index.html

# On Linux:
xdg-open index.html

# On Windows:
start index.html

# Or simply open docs/index.html in any web browser
```

The website is fully static (HTML/CSS/JavaScript) and can be hosted on GitHub Pages, Netlify, or any static hosting service.

### Adding New Tournament Data

1. Export your tournament sheets as CSV files
2. Create a folder named `YYYY-MM-DD` in `downloaded_sheets/`
3. Place the poule sheet and DE sheet (with `_DE.csv` suffix) in the folder
4. Run `python track_match_history.py` to update ratings
5. Refresh the website to see updated data

### Tuning the System

All Elo system parameters are constants at the top of `src/track_match_history.py`:

```python
BASE_K = 30                    # Base K-factor
STARTING_RATING = 1800         # Initial rating for new fencers
MARGIN_SCORE_MAP = {...}       # Poule margin adjustments
BRACKET_WEIGHTS = {...}        # DE bracket importance multipliers
PLACEMENT_BONUSES = {...}      # Tournament finish bonuses
DECAY_AFTER_SESSIONS = 8       # Inactivity decay threshold
DECAY_RATE = 0.08              # Decay percentage per session
```

Modify these values and re-run the script to see how ratings change. The system is deterministic, so you can experiment freely and revert changes.

### Name Aliases

To consolidate different spellings of the same person (e.g., "Alex" and "Alix"), edit the `NAME_ALIASES` list in `track_match_history.py`:

```python
NAME_ALIASES = [
    ['Canonical Name', 'Alias1', 'Alias2'],
    ['Another Name', 'AnotherAlias'],
]
```

## Project Structure

```
FencingTracker/
├── src/
│   ├── track_match_history.py    # Main Elo calculation script
│   └── outputs/                  # Generated CSV files (backup)
├── docs/                         # Static website
│   ├── index.html               # About page (landing page)
│   ├── leaderboard.html         # Current rankings
│   ├── fencer.html              # Individual fencer stats
│   ├── sessions.html            # Tournament history
│   ├── timeline.html            # Interactive Elo charts
│   ├── css/style.css            # Styling
│   ├── js/                      # JavaScript for interactivity
│   │   ├── app.js              # Leaderboard logic
│   │   ├── fencer.js           # Fencer page logic
│   │   ├── sessions.js         # Tournament history logic
│   │   └── timeline.js         # Chart rendering
│   └── data/                    # JSON/CSV data for website
│       ├── elo_ratings.json
│       ├── elo_timeline.json
│       ├── sessions.json
│       └── head_to_head.json
└── downloaded_sheets/           # Tournament data (CSV files)
    └── YYYY-MM-DD/
        ├── SessionName.csv
        └── SessionName_DE.csv
```

## Technical Details

### Elo Calculation

For each match, the rating change is:
```
ΔR = K × (Actual - Expected)

Expected = 1 / (1 + 10^((R_opponent - R_player) / 400))
```

**Poule matches:** `Actual` is margin-adjusted (0.0 to 1.0 based on score differential)
**DE matches:** `Actual` is binary (1.0 for win, 0.0 for loss), with K multiplied by bracket weight and field size scaling

### Upset Score

Upset indicators show `|Actual - Expected|`. A score of 0 means the result was perfectly expected, while 1.0 is the maximum possible upset. Colors range from grey (expected) to bright red (upset) using a power-2.5 scale to emphasize surprises.

### Data Processing Order

Matches are processed chronologically by session date. Within each session:
1. All poule matches (shuffled to avoid ordering bias)
2. Snapshot taken ("After Poules")
3. All DE matches (in bracket order)
4. Placement bonuses applied
5. Snapshot taken ("After DEs")
6. Inactivity decay applied to absent fencers

## Contributing

This project was built with assistance from [Claude Code](https://code.claude.com/docs/en/overview). Contributions are welcome! Feel free to:

- Tweak Elo parameters and share interesting results
- Improve the website UI/UX
- Add new visualizations or statistics
- Optimize data processing
- Report bugs or suggest features

Submit pull requests to the [GitHub repository](https://github.com/Alex3400/FencingTracker).

## License

This project is open source. Feel free to use and modify it for your own fencing club or tournament series.

## Acknowledgments

Heavily inspired by [Fencing Tracker](https://fencingtracker.com/) for USA fencing. Built for the Haverstock Fencing Club Tuesday sessions.

## Contact

For questions or feedback, contact Alex Yule:
- Email: ayule801@gmail.com
- WhatsApp: +44 7578 915787
