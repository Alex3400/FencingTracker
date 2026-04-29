#!/usr/bin/env python3
"""
Analyze head-to-head matchups between two fencers.

Usage:
    python analyze_matchup.py "Fencer1" "Fencer2"

Example:
    python analyze_matchup.py "Alex Y" "Vivian"
"""

import csv
import sys


def get_matchup_data(fencer1, fencer2, elo_history_file='../docs/data/elo_history.csv',
                     elo_ratings_file='../docs/data/elo_ratings.csv',
                     head_to_head_file='../docs/data/head_to_head_stats.csv',
                     fencer_stats_file='../docs/data/fencer_stats.csv',
                     placement_stats_file='../docs/data/placement_stats.csv'):
    """
    Extract matchup data between two fencers from ELO history and head-to-head stats.

    Returns a dictionary containing:
    - fencer1, fencer2: names
    - matches: list of all matches with ratings and changes
    - f1_wins, f2_wins: win counts
    - f1_current_rating, f2_current_rating: current ratings from elo_ratings.csv
    - f1_expected, f2_expected: expected win probabilities
    - Additional stats from head_to_head_stats.csv:
        - poule_matches, de_matches
        - f1_poule_wins, f2_poule_wins, f1_de_wins, f2_de_wins
        - f1_touches_scored, f2_touches_scored, touch_differential
        - first_match_date, last_match_date
    - Individual fencer stats from fencer_stats.csv:
        - f1_avg_seeding, f2_avg_seeding
        - f1_avg_placement, f2_avg_placement
        - f1_placement_history, f2_placement_history (from placement_stats.csv)

    Returns None if no matches found or file not found.
    """
    matches = []

    # Read ELO history CSV
    try:
        with open(elo_history_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                winner = row['Winner']
                loser = row['Loser']

                # Check if this match involves both fencers
                if (winner == fencer1 and loser == fencer2) or \
                   (winner == fencer2 and loser == fencer1):

                    # Determine who is fencer1 and who is fencer2
                    if winner == fencer1:
                        f1_won = True
                        f1_old_rating = float(row['Winner Old Rating'])
                        f1_new_rating = float(row['Winner New Rating'])
                        f1_change = float(row['Winner Change'])
                        f2_old_rating = float(row['Loser Old Rating'])
                        f2_new_rating = float(row['Loser New Rating'])
                        f2_change = float(row['Loser Change'])
                    else:
                        f1_won = False
                        f1_old_rating = float(row['Loser Old Rating'])
                        f1_new_rating = float(row['Loser New Rating'])
                        f1_change = float(row['Loser Change'])
                        f2_old_rating = float(row['Winner Old Rating'])
                        f2_new_rating = float(row['Winner New Rating'])
                        f2_change = float(row['Winner Change'])

                    matches.append({
                        'date': row['Date'],
                        'type': row['Match Type'],
                        'result': row['Result'],
                        'f1_won': f1_won,
                        'f1_old_rating': f1_old_rating,
                        'f1_new_rating': f1_new_rating,
                        'f1_change': f1_change,
                        'f2_old_rating': f2_old_rating,
                        'f2_new_rating': f2_new_rating,
                        'f2_change': f2_change
                    })
    except FileNotFoundError:
        print(f"Error: Could not find {elo_history_file}")
        print(f"Make sure you run this from the src/ directory and have generated the data files")
        return None

    if not matches:
        print(f"\nNo matches found between {fencer1} and {fencer2}")
        return None

    # Calculate statistics
    f1_wins = sum(1 for m in matches if m['f1_won'])
    f2_wins = len(matches) - f1_wins

    # Get current ratings from elo_ratings.csv
    f1_current = None
    f2_current = None
    try:
        with open(elo_ratings_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['Fencer'] == fencer1:
                    f1_current = float(row['Final ELO Rating'])
                if row['Fencer'] == fencer2:
                    f2_current = float(row['Final ELO Rating'])
                if f1_current is not None and f2_current is not None:
                    break
    except FileNotFoundError:
        print(f"Warning: Could not find {elo_ratings_file}, using ratings from last match")
        # Fallback to last match ratings
        last_match = matches[-1]
        f1_current = last_match['f1_new_rating']
        f2_current = last_match['f2_new_rating']

    # If not found in elo_ratings.csv, use last match ratings as fallback
    if f1_current is None or f2_current is None:
        last_match = matches[-1]
        if f1_current is None:
            f1_current = last_match['f1_new_rating']
        if f2_current is None:
            f2_current = last_match['f2_new_rating']

    # ELO expected score formula
    f1_expected = 1 / (1 + 10**((f2_current - f1_current) / 400))
    f2_expected = 1 - f1_expected

    # Get additional stats from head_to_head_stats.csv
    h2h_stats = None
    try:
        with open(head_to_head_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Check if this row matches our fencers
                if row['Fencer 1'] == fencer1 and row['Fencer 2'] == fencer2:
                    h2h_stats = {
                        'poule_matches': int(row['Poule Matches']),
                        'f1_poule_wins': int(row['Fencer 1 Poule Wins']),
                        'f2_poule_wins': int(row['Fencer 2 Poule Wins']),
                        'de_matches': int(row['DE Matches']),
                        'f1_de_wins': int(row['Fencer 1 DE Wins']),
                        'f2_de_wins': int(row['Fencer 2 DE Wins']),
                        'f1_touches_scored': int(row['Fencer 1 Touches Scored']),
                        'f2_touches_scored': int(row['Fencer 2 Touches Scored']),
                        'touch_differential': int(row['Touch Differential (F1 - F2)']),
                        'first_match_date': row['First Match Date'],
                        'last_match_date': row['Last Match Date']
                    }
                    break
    except FileNotFoundError:
        print(f"Warning: Could not find {head_to_head_file}")

    result = {
        'fencer1': fencer1,
        'fencer2': fencer2,
        'matches': matches,
        'f1_wins': f1_wins,
        'f2_wins': f2_wins,
        'f1_current_rating': f1_current,
        'f2_current_rating': f2_current,
        'f1_expected': f1_expected,
        'f2_expected': f2_expected
    }

    # Add head-to-head stats if found
    if h2h_stats:
        result.update(h2h_stats)

    # Get individual fencer stats (avg seeding, avg placement)
    try:
        with open(fencer_stats_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['Fencer'] == fencer1:
                    result['f1_avg_seeding'] = float(row['Avg Seeding']) if row['Avg Seeding'] else None
                    result['f1_avg_placement'] = float(row['Avg Placement']) if row['Avg Placement'] else None
                if row['Fencer'] == fencer2:
                    result['f2_avg_seeding'] = float(row['Avg Seeding']) if row['Avg Seeding'] else None
                    result['f2_avg_placement'] = float(row['Avg Placement']) if row['Avg Placement'] else None
    except (FileNotFoundError, ValueError, KeyError):
        pass  # Stats not available

    # Get placement history with field sizes
    try:
        with open(placement_stats_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['Fencer'] == fencer1:
                    # Parse placement history from all columns
                    f1_placements = []
                    for col in ['Win', 'L2', 'L4', 'L8', 'L16', 'L32']:
                        if row[col] and row[col] != '0':
                            f1_placements.append(f"{col}: {row[col]}")
                    result['f1_placement_history'] = "; ".join(f1_placements) if f1_placements else "No placements"

                if row['Fencer'] == fencer2:
                    # Parse placement history from all columns
                    f2_placements = []
                    for col in ['Win', 'L2', 'L4', 'L8', 'L16', 'L32']:
                        if row[col] and row[col] != '0':
                            f2_placements.append(f"{col}: {row[col]}")
                    result['f2_placement_history'] = "; ".join(f2_placements) if f2_placements else "No placements"
    except (FileNotFoundError, KeyError):
        pass  # Placement history not available

    return result


def print_matchup_analysis(matchup_data):
    """
    Print formatted matchup analysis from matchup data dictionary.

    Takes the output from get_matchup_data() and displays it in a readable format.
    """
    if matchup_data is None:
        return

    fencer1 = matchup_data['fencer1']
    fencer2 = matchup_data['fencer2']
    matches = matchup_data['matches']
    f1_wins = matchup_data['f1_wins']
    f2_wins = matchup_data['f2_wins']
    f1_latest = matchup_data['f1_current_rating']
    f2_latest = matchup_data['f2_current_rating']
    f1_expected = matchup_data['f1_expected']
    f2_expected = matchup_data['f2_expected']

    # Print results
    print(f"\n{'='*100}")
    print(f"MATCHUP ANALYSIS: {fencer1} vs {fencer2}")
    print(f"{'='*100}")
    print(f"\nOVERALL STATISTICS:")
    print(f"  Total matches: {len(matches)}")
    print(f"  {fencer1} wins: {f1_wins} ({f1_wins/len(matches)*100:.1f}%)")
    print(f"  {fencer2} wins: {f2_wins} ({f2_wins/len(matches)*100:.1f}%)")

    # Print breakdown by match type if available
    if 'poule_matches' in matchup_data:
        poule_matches = matchup_data['poule_matches']
        de_matches = matchup_data['de_matches']
        f1_poule_wins = matchup_data['f1_poule_wins']
        f2_poule_wins = matchup_data['f2_poule_wins']
        f1_de_wins = matchup_data['f1_de_wins']
        f2_de_wins = matchup_data['f2_de_wins']

        print(f"\n  Poule matches: {poule_matches}")
        if poule_matches > 0:
            print(f"    {fencer1}: {f1_poule_wins} wins ({f1_poule_wins/poule_matches*100:.1f}%)")
            print(f"    {fencer2}: {f2_poule_wins} wins ({f2_poule_wins/poule_matches*100:.1f}%)")

        print(f"  DE matches: {de_matches}")
        if de_matches > 0:
            print(f"    {fencer1}: {f1_de_wins} wins ({f1_de_wins/de_matches*100:.1f}%)")
            print(f"    {fencer2}: {f2_de_wins} wins ({f2_de_wins/de_matches*100:.1f}%)")

    # Print touch statistics if available
    if 'f1_touches_scored' in matchup_data:
        f1_touches = matchup_data['f1_touches_scored']
        f2_touches = matchup_data['f2_touches_scored']
        touch_diff = matchup_data['touch_differential']

        print(f"\n  Total touches scored:")
        print(f"    {fencer1}: {f1_touches} touches")
        print(f"    {fencer2}: {f2_touches} touches")
        print(f"    Differential: {touch_diff:+d} ({fencer1})")

    # Print match timeline if available
    if 'first_match_date' in matchup_data:
        print(f"\n  Match timeline:")
        print(f"    First match: {matchup_data['first_match_date']}")
        print(f"    Last match: {matchup_data['last_match_date']}")

    print(f"\n  Current ratings: {fencer1} {f1_latest:.1f} | {fencer2} {f2_latest:.1f}")
    print(f"  Rating difference: {abs(f1_latest - f2_latest):.1f} points")
    print(f"  Expected outcome: {fencer1} {f1_expected*100:.1f}% | {fencer2} {f2_expected*100:.1f}%")

    # Print individual fencer stats if available
    if 'f1_avg_seeding' in matchup_data or 'f2_avg_seeding' in matchup_data:
        print(f"\n  Average seeding:")
        if 'f1_avg_seeding' in matchup_data and matchup_data['f1_avg_seeding']:
            print(f"    {fencer1}: {matchup_data['f1_avg_seeding']:.1f}")
        if 'f2_avg_seeding' in matchup_data and matchup_data['f2_avg_seeding']:
            print(f"    {fencer2}: {matchup_data['f2_avg_seeding']:.1f}")

    if 'f1_avg_placement' in matchup_data or 'f2_avg_placement' in matchup_data:
        print(f"  Average placement:")
        if 'f1_avg_placement' in matchup_data and matchup_data['f1_avg_placement']:
            print(f"    {fencer1}: {matchup_data['f1_avg_placement']:.1f}")
        if 'f2_avg_placement' in matchup_data and matchup_data['f2_avg_placement']:
            print(f"    {fencer2}: {matchup_data['f2_avg_placement']:.1f}")

    # Print placement history if available
    if 'f1_placement_history' in matchup_data or 'f2_placement_history' in matchup_data:
        print(f"\n  Placement history:")
        if 'f1_placement_history' in matchup_data:
            print(f"    {fencer1}: {matchup_data['f1_placement_history']}")
        if 'f2_placement_history' in matchup_data:
            print(f"    {fencer2}: {matchup_data['f2_placement_history']}")

    print(f"\n{'='*100}")
    print(f"MATCH HISTORY (chronological):")
    print(f"{'='*100}")
    print(f"{'Date':<12} {'Type':<12} {'Result':<40} {fencer1 + ' ELO':<25} {fencer2 + ' ELO':<25}")
    print(f"{'-'*100}")

    for match in matches:
        winner_marker = "✓" if match['f1_won'] else " "
        loser_marker = " " if match['f1_won'] else "✓"

        f1_rating_str = f"{match['f1_old_rating']:.1f} → {match['f1_new_rating']:.1f} ({match['f1_change']:+.1f})"
        f2_rating_str = f"{match['f2_old_rating']:.1f} → {match['f2_new_rating']:.1f} ({match['f2_change']:+.1f})"

        result = match['result']

        print(f"{match['date']:<12} {match['type']:<12} {result:<40} {winner_marker} {f1_rating_str:<23} {loser_marker} {f2_rating_str:<23}")

    print(f"{'='*100}\n")


def analyze_matchup(fencer1, fencer2, elo_history_file='../docs/data/elo_history.csv',
                   elo_ratings_file='../docs/data/elo_ratings.csv',
                   head_to_head_file='../docs/data/head_to_head_stats.csv',
                   fencer_stats_file='../docs/data/fencer_stats.csv',
                   placement_stats_file='../docs/data/placement_stats.csv'):
    """
    Convenience function that gets matchup data and prints the analysis.

    Returns the matchup data dictionary.
    """
    matchup_data = get_matchup_data(fencer1, fencer2, elo_history_file, elo_ratings_file,
                                   head_to_head_file, fencer_stats_file, placement_stats_file)
    print_matchup_analysis(matchup_data)
    return matchup_data


if __name__ == '__main__':
    if len(sys.argv) != 3:

        fencer1 = "Alex Y"
        fencer2 = "Greg"
    else:

        fencer1 = sys.argv[1]
        fencer2 = sys.argv[2]

    analyze_matchup(fencer1, fencer2)
