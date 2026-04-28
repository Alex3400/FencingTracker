# Website Setup Guide

## Testing Locally

To test the website on your computer before deploying:

1. Navigate to the `docs` folder:
   ```bash
   cd /Users/ayule/PycharmProjects/FencingTracker/docs
   ```

2. Start a simple local server:
   ```bash
   python3 -m http.server 8000
   ```

3. Open your browser and go to:
   ```
   http://localhost:8000
   ```

4. You should see the leaderboard page. Click around to test all features!

## Deploying to GitHub Pages

### One-time Setup:

1. **Push your code to GitHub:**
   ```bash
   cd /Users/ayule/PycharmProjects/FencingTracker
   git add docs/
   git commit -m "Add ELO ratings website"
   git push origin main
   ```

2. **Enable GitHub Pages:**
   - Go to https://github.com/Alex3400/FencingTracker/settings/pages
   - Under "Build and deployment":
     - Source: Deploy from a branch
     - Branch: `main`
     - Folder: `/docs`
   - Click "Save"

3. **Wait 1-2 minutes**, then visit:
   ```
   https://alex3400.github.io/FencingTracker/
   ```

### Updating the Website:

Whenever you have new tournament data:

1. **Run the Python script:**
   ```bash
   cd /Users/ayule/PycharmProjects/FencingTracker/src
   python3 track_match_history.py
   ```

2. **Commit and push the updated data:**
   ```bash
   cd ..
   git add docs/data/*.json
   git commit -m "Update ratings after [date] tournament"
   git push origin main
   ```

3. **Wait 1-2 minutes** for GitHub Pages to rebuild

That's it! The website will automatically update.

## Website Features

### ✅ Implemented:

1. **Leaderboard** (`index.html`)
   - Sortable, searchable table of all fencers
   - Filter by Established (30+ matches) or Provisional
   - Top 3 highlighted in gold/silver/bronze

2. **ELO Timeline** (`timeline.html`)
   - Interactive line charts showing rating progression
   - Select any fencers to compare
   - "Top 5" quick button
   - Shows rating changes after every tournament session

3. **Head-to-Head Matchups** (`matchups.html`)
   - Compare any two fencers
   - Overall win/loss records
   - Breakdown by Poule vs DE matches
   - Current ratings and expected win probabilities

4. **Tournament History** (`sessions.html`)
   - Sortable table of all past tournaments
   - Winners, top poule climbers, participant counts
   - Search by date or fencer name

## Troubleshooting

**Website not loading data?**
- Make sure the JSON files exist in `docs/data/`
- Check browser console (F12) for errors
- Verify the files aren't empty

**GitHub Pages showing 404?**
- Double-check the branch and folder settings
- Make sure the `docs` folder is in the `main` branch
- Wait a few minutes for the site to build

**Charts not displaying?**
- Make sure Chart.js is loading from CDN
- Check if data format matches expected structure
- Look in browser console for JavaScript errors
