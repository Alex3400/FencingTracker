# Haverstock Fencing Tracker

This is the code behind the Haverstock Fencing Elo leaderboard:

**[alex3400.github.io/FencingTracker](https://alex3400.github.io/FencingTracker/)**

Every Tuesday a few of us turn up, fence a poule and a DE, and someone scribbles the results on a Google Sheet. This project reads those sheets, runs every match through a (slightly modified) Elo rating system, and spits out the leaderboard, fencer pages, session history, and timeline charts you see on the site.

It's all open source. If you fence at the club and want to poke at how the ratings work — or fork it and try your own scoring rules — this README is for you.

---

## Contents

- [The short version](#the-short-version)
- [How the rating system works](#how-the-rating-system-works)
- [What's in the repo](#whats-in-the-repo)
- [Running it on your own machine](#running-it-on-your-own-machine)
- [Adding a new Tuesday session](#adding-a-new-tuesday-session)
- [Playing with the parameters](#playing-with-the-parameters)
- [Name aliases and the blacklist](#name-aliases-and-the-blacklist)
- [Contributing and contact](#contributing-and-contact)

---

## The short version

1. Tournament sheets are stored as CSVs under `src/downloaded_sheets/YYYY-MM-DD/` — one poule sheet and one DE bracket per session.
2. `src/track_match_history.py` walks every session in date order, plays every match through the Elo formula, and writes the results out as CSV and JSON.
3. The static site under `docs/` reads those JSON/CSV files and renders the leaderboard, fencer pages, etc. with vanilla JavaScript.
4. GitHub Pages serves `docs/` as the public site.

No database, no backend, no build step. Open `docs/index.html` in a browser and it just works.

---

## How the rating system works

If you've never seen Elo before: it's the same family of rating systems used in chess, go, and most online matchmaking. Two ideas hold the whole thing up:

- **Everyone gets a number.** New fencers start at 1500.
- **Win = number goes up. Lose = number goes down. The size of the swing depends on who you fenced.** Beating someone rated higher than you is worth more points than beating someone rated lower. If a 1700 beats a 1500, the system shrugs ("yeah, expected"). If the 1500 beats the 1700, the points fly.

The exact formula is:

```
expected_score = 1 / (1 + 10^((opponent_rating - my_rating) / 400))
delta = K * (actual_score - expected_score)
```

`actual_score` is 1 for a win, 0 for a loss (with a wrinkle for poules — see below). `K` controls how big the swings are.

### Margin scoring in poules

Poules use a custom mapping:

| Score | Winner gets | Loser gets |
|-------|-------------|------------|
| 5–4 | 0.72 | 0.28 |
| 5–3 | 0.80 | 0.20 |
| 5–2 | 0.88 | 0.12 |
| 5–1 | 0.95 | 0.05 |
| 5–0 | 1.00 | 0.00 |

This is why you'll occasionally see the higher-rated fencer **lose** points after winning a poule match 5–4 — the system expected a more decisive win than they got.

### DE matches are weighted heavier than poules

DE bouts are higher-signal than a quick poule pool. The base K-factor gets multiplied by:

- A floor of **1.8x** for any DE (vs. 1.0x for a poule)
- A bracket multiplier on top — finals are around **2.8x**, quarters around **2.2x**, the lower brackets around **1.8x–1.9x**
- A field-size adjustment so a 30-fencer tournament weighs slightly heavier than a 12-fencer one (gentle scaling, capped)

DEs use binary 1.0/0.0 outcomes (no margin scoring).

### Newer fencers move faster

The K-factor scales with how many matches you've played, so new fencers converge on a sensible rating quickly while veterans don't see wild swings:

| Matches played | K-factor |
|----------------|----------|
| 0–19 (provisional) | 32 |
| 20–49 (settling) | 28 |
| 50+ (established) | 25 |

After 50 matches you're "established" and the K stays put — no further decay.

### Walkovers

Sometimes a DE bout doesn't actually get fenced — someone has to leave early, picks up an injury, or just bows out. On the DE sheet that gets marked with an **X** next to the absent fencer's name (and a **V** next to whoever advances).

The script picks that up and treats it as a walkover:

- The match still gets recorded in the history and shows up in the bracket — you'll see it tagged "won (walkover)" / "lost (walkover)".
- **No Elo changes for either fencer**, since the result tells us nothing about who's actually better.
- The advancing fencer can still earn Elo from later matches in the bracket as normal.

So if you advance to the final on a walkover and then win it, you'll only see Elo movement from the final itself.

### Active status

A fencer counts as **Active** if they've fenced in **5+ of the last 40 sessions**, OR **3+ of the last 6 sessions**.

### Inactivity decay

If you stop coming for **8 consecutive sessions**, your rating starts decaying by 5% per missed session, but only if you're rated above **1600** and only down to 1600. This is mostly to keep one-off guests with a freakishly high or low rating from cluttering the top of the leaderboard. Active fencers and anyone below 1600 are untouched.

---

## What's in the repo

```
FencingTracker/
├── README.md                       <- you are here
├── src/
│   ├── track_match_history.py      <- the main script: parses sheets, runs Elo, writes output
│   ├── analyze_matchup.py          <- CLI tool to print head-to-head stats for two fencers
│   ├── downloaded_sheets/
│   │   ├── download_sheets.py      <- downloads all sheets in google_sheets_links.txt as CSVs
│   │   ├── google_sheets_links.txt <- list of (date, sheet URL) pairs
│   │   ├── 2023-01-10/             <- one folder per session
│   │   │   ├── <sheet_id>.csv      <- poule sheet
│   │   │   └── <sheet_id>_DE.csv   <- DE bracket
│   │   └── ... (140-ish more session folders)
│   └── outputs/                    <- CSV/text exports from the main script (local copy)
├── docs/                           <- the static website (this is what GitHub Pages serves)
│   ├── index.html                  <- About page
│   ├── leaderboard.html
│   ├── fencer.html
│   ├── sessions.html
│   ├── timeline.html
│   ├── css/style.css
│   ├── js/                         <- one .js file per page, vanilla JS
│   └── data/                       <- JSON + CSV files the site reads
└── outputs/                        <- legacy output dir, not currently used
```

The pipeline, end to end, is:

```
google_sheets_links.txt ──> download_sheets.py ──> downloaded_sheets/YYYY-MM-DD/*.csv
                                                              │
                                                              v
                                                     track_match_history.py
                                                              │
                                                     ┌────────┴────────┐
                                                     v                 v
                                              src/outputs/         docs/data/
                                              (local CSVs)         (powers the site)
```

In practice you only need the last step — running `track_match_history.py` after dropping new CSVs into `downloaded_sheets/`. The download script is handy when there are several new sessions to bring in at once.

---

## Running it on your own machine

### What you need

- Python 3.7 or newer
- That's it for the rating script. Optional: `matplotlib` if you want PNG charts written out alongside the CSVs.

```bash
git clone https://github.com/Alex3400/FencingTracker.git
cd FencingTracker

# (optional but recommended)
python3 -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate

# (optional) for chart export
pip install matplotlib

# (optional) only needed if you want to use download_sheets.py
pip install pandas openpyxl aiohttp
```

### Run the rating script

```bash
cd src
python track_match_history.py
```

It walks every folder in `src/downloaded_sheets/` chronologically and writes:

- `src/outputs/` — full CSV exports (ratings, history, head-to-head, etc.)
- `docs/data/` — the same data plus JSON files for the website

Expect it to take a few seconds to run.

### Look at the site locally

The site is just static files, so:

```bash
# from the repo root
open docs/index.html              # macOS
xdg-open docs/index.html          # Linux
start docs/index.html             # Windows
```

If your browser blocks the `fetch()` calls because of `file://` CORS rules (Chrome will, Safari mostly won't), serve it instead:

```bash
cd docs
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## Adding a new Tuesday session

You've got two options.

### Option A: drop the CSVs in by hand

1. Export the poule sheet and DE bracket from Google Sheets as CSV (`File → Download → CSV`).
2. Make a folder `src/downloaded_sheets/YYYY-MM-DD/` (whatever date you want the session attributed to — the folder name is the source of truth for ordering).
3. Drop the two CSVs in. The DE one **must** end in `_DE.csv` so the parser knows which is which. Anything else works as the poule sheet name.
4. Run `python src/track_match_history.py`.

### Option B: pull a batch of sheets in one go

When several weeks have piled up:

1. Add `(date, sheet URL)` lines to `src/downloaded_sheets/google_sheets_links.txt`.
2. `cd src/downloaded_sheets && python download_sheets.py` — async-downloads each sheet, both the main tab and the DE tab, into the right dated folder.
3. Run the main script as in Option A.

The download script also validates that what it pulled looks like a poule sheet (it'll skip and warn if a tab doesn't have the expected V/score grid).

---

## Playing with the parameters

This is the fun bit. Every Elo knob lives at the top of `src/track_match_history.py`, around lines 30–125, and the script is fully deterministic — same inputs always produce the same outputs — so you can tweak, re-run, look at the leaderboard, and revert. Nothing's destructive.

A few starting points if you want to mess about:

- **Want fewer point swings?** Drop `BASE_K`, or shave the `K_FACTOR_THRESHOLDS` values.
- **Think DEs are over-weighted?** Lower the `BRACKET_WEIGHTS` floor or flatten the curve.
- **Don't like margin scoring?** Set `USE_MARGIN_SCORING = False` and every poule win counts the same. Or rewrite `MARGIN_SCORE_MAP` with your own values.
- **Want the formula version of margin scoring instead of the table?** Set `MARGIN_SCORE_MAP = None` and tune `MARGIN_DIVISOR` / `MARGIN_EXPONENT`.
- **Decay too aggressive (or not aggressive enough)?** Tweak `DECAY_AFTER_SESSIONS`, `DECAY_RATE`, `DECAY_TARGET`.
- **Different starting rating?** Change `STARTING_RATING`. 

The relevant constants:

```python
BASE_K = 24
STARTING_RATING = 1500
RATING_FLOOR, RATING_CEILING = 1000, 2600

K_FACTOR_THRESHOLDS = {0: 32, 20: 28, 50: 25}

USE_MARGIN_SCORING = True
MARGIN_SCORE_MAP = {(5,4): 0.72, (5,3): 0.80, (5,2): 0.88, (5,1): 0.95, (5,0): 1.00}

BRACKET_WEIGHTS = {'L1-2': 2.8, 'L1-4': 2.5, 'L1-8': 2.2, ...}
FIELD_SIZE_BASELINE = 20
FIELD_SIZE_SCALING_EXPONENT = 0.3

DECAY_AFTER_SESSIONS = 8
DECAY_RATE = 0.05
DECAY_TARGET = 1600
```

After tweaking, re-run the script and refresh the site. Comparing two leaderboards before/after a change is a fast way to feel out what each parameter actually does.

### Order of operations within a session

For the curious, here's exactly what happens when the script processes one session:

1. All poule matches are played in shuffled order (so the order within the session doesn't bias anything).
2. A snapshot is taken — this is what shows up as "After Poules".
3. All DE matches are played in bracket order (lowest bracket first, finals last).
4. A second snapshot — "After DEs".
5. Anyone who's missed `DECAY_AFTER_SESSIONS` in a row gets nudged toward `DECAY_TARGET`.

There are no separate placement bonuses any more — finishing high in the bracket already pays out through the bracket weights on the DE matches you won.

---

## Name aliases and the blacklist

The sheets are filled in by hand, so the same person shows up as "Alex Y", "Alex", "Alex Yule", or whatever else got typed. There's a list near the top of `track_match_history.py`:

```python
NAME_ALIASES = [
    ['Canonical Name', 'Alias1', 'Alias2'],
    ...
]
```

The first entry in each row is the canonical name; everything else gets folded into it. If you spot a fencer who appears twice on the leaderboard under near-identical names, that's the file to edit.

The `BLACKLIST` next to it does the opposite — it strips a name (and all its aliases) out of the data entirely, including any matches involving them. Currently used for sheet noise like `#Error!` and `#Ref!`. If anyone ever asks to be removed from the site, their canonical name goes in here.

---

## Contributing and contact

Pull requests welcome. Things that would be cool:

- Better visualisations on the timeline / fencer pages
- New stats (longest win streak? biggest single-night Elo gain?)
- A more rigorous take on the rating math — I freestyled most of the multipliers, and I'd love a second opinion from anyone who's done this kind of thing before
- UI polish on mobile

The code was written with a lot of help from [Claude Code](https://code.claude.com/docs/en/overview); the prose on the site (and in this README) is mine.

If something on the site looks wrong, or you'd rather your name be aliased or removed entirely, just message me — there's no awkwardness in asking:

- **WhatsApp**: +44 7578 915787
- **Email**: ayule801@gmail.com
- Or talk to me at practice :).

— Alex Y.
