#!/usr/bin/env python3
"""
Track match history between pairs of fencers across all tournaments.
Parses both poule sheets and DE (Direct Elimination) sheets.
Implements ELO rating system for fencer skill tracking.
"""

import os
import csv
import math
import random
from collections import defaultdict
from pathlib import Path


# ============================================================
# ELO SYSTEM CONFIGURATION
# ============================================================

# Base K-factor (how much ratings change per match)
BASE_K = 40

# Starting rating for new fencers
STARTING_RATING = 1400

# Rating bounds
RATING_FLOOR = 600
RATING_CEILING = 2200

# K-factor scaling by experience (number of matches)
K_FACTOR_THRESHOLDS = {
    0: 50,    # New players (0-19 matches): fast convergence
    20: 45,   # Developing (20-49 matches): still adapting
    50: 40,   # Established (50-149 matches): moderate changes
    150: 32   # Veterans (150+ matches): stable ratings
}

# Minimum matches required for rating to be "established"
# Fencers below this threshold get a provisional flag
MIN_MATCHES_FOR_ESTABLISHED = 30

# Use margin-adjusted scoring for poules (True) or binary win/loss (False)
USE_MARGIN_SCORING = True

# DE bracket importance weights (multiplier on base K)
# Increased to create more rating spread
BRACKET_WEIGHTS = {
    # Top brackets (fighting for podium)
    'L1-2': 5.0,    # Increased from 4.0
    'L1-4': 4.0,    # Increased from 3.0
    'L1-8': 3.0,    # Increased from 2.5
    'L1-16': 2.5,   # Increased from 2.0
    'L1-32': 2.0,   # Increased from 1.5

    # Medal matches
    'L3-4': 4.0,    # Increased from 3.0

    # Mid-tier brackets
    'L5-8': 2.5,    # Increased from 2.0
    'L9-16': 2.0,   # Increased from 1.5
    'L9-12': 2.0,   # Increased from 1.5
    'L13-16': 1.8,  # Increased from 1.3

    # Lower brackets (consolation rounds)
    'L17-32': 1.2,  # Increased from 1.0
    'L17-24': 1.2,  # Increased from 1.0
    'L25-32': 1.0,  # Increased from 0.8
}

# Field size scaling parameters
FIELD_SIZE_BASELINE = 20  # Average tournament size for normalization
FIELD_SIZE_SCALING_EXPONENT = 0.5  # 0.5 = sqrt scaling, 1.0 = linear

# Placement bonuses (flat rating adjustment after tournament)
# Scaled down to prevent single-tournament spikes
PLACEMENT_BONUSES = {
    1: 15,   # Winner bonus (reduced from 25)
    2: 10,   # Runner-up bonus (reduced from 15)
    3: 5,    # Third place bonus (reduced from 8)
    4: 5,    # Fourth place bonus (reduced from 8)
}

# ELO scaling factor (standard is 400)
ELO_SCALING_FACTOR = 400


# ============================================================
# ELO SYSTEM FUNCTIONS
# ============================================================

def get_k_factor(num_matches):
    """Get K-factor based on number of matches played."""
    for threshold in sorted(K_FACTOR_THRESHOLDS.keys(), reverse=True):
        if num_matches >= threshold:
            return K_FACTOR_THRESHOLDS[threshold]
    return BASE_K


def calculate_expected_score(rating_a, rating_b):
    """Calculate expected score for player A against player B."""
    return 1 / (1 + 10 ** ((rating_b - rating_a) / ELO_SCALING_FACTOR))


def calculate_poule_actual_score(your_score, their_score):
    """
    Calculate margin-adjusted actual score for poule matches.
    Returns value between 0 and 1.
    """
    if not USE_MARGIN_SCORING:
        return 1.0 if your_score > their_score else 0.0

    # Margin-adjusted: 0.5 + (difference / 10)
    # 5-0: 1.0, 5-1: 0.9, 5-2: 0.8, 5-3: 0.7, 5-4: 0.6
    # 4-5: 0.4, 3-5: 0.3, etc.
    return 0.5 + (your_score - their_score) / 10


def get_bracket_weight(bracket_name):
    """Get importance weight for a DE bracket."""
    # Try exact match first
    if bracket_name in BRACKET_WEIGHTS:
        return BRACKET_WEIGHTS[bracket_name]

    # Extract bracket range and try to match patterns
    # E.g., "L17-24" should match "L17-24" or fall back to "L17-32"
    if bracket_name.startswith('L'):
        # Try to match by starting position
        for pattern, weight in BRACKET_WEIGHTS.items():
            if pattern.startswith('L1-'):
                bracket_size = int(pattern.split('-')[1])
                if bracket_name.startswith('L1-') and int(bracket_name.split('-')[1]) <= bracket_size:
                    return weight

    # Default weight
    return 1.0


def get_field_size_multiplier(total_fencers):
    """Calculate field size scaling multiplier."""
    return (total_fencers / FIELD_SIZE_BASELINE) ** FIELD_SIZE_SCALING_EXPONENT


def apply_rating_bounds(rating):
    """Ensure rating stays within floor and ceiling."""
    return max(RATING_FLOOR, min(RATING_CEILING, rating))


class ELORatingSystem:
    """Manages ELO ratings for all fencers."""

    def __init__(self):
        # Current ratings: {fencer_name: rating}
        self.ratings = {}
        # Match counts: {fencer_name: count}
        self.match_counts = {}
        # Rating history: {fencer_name: [(date, rating, reason), ...]}
        self.rating_history = defaultdict(list)
        # Match-based history: [(date, fencer1, old_rating1, new_rating1, change1,
        #                        fencer2, old_rating2, new_rating2, change2, match_type), ...]
        self.match_history = []

    def get_rating(self, fencer):
        """Get current rating for a fencer (initialize if new)."""
        if fencer not in self.ratings:
            self.ratings[fencer] = STARTING_RATING
            self.match_counts[fencer] = 0
            self.rating_history[fencer].append(('START', STARTING_RATING, 'Initial rating'))
        return self.ratings[fencer]

    def get_match_count(self, fencer):
        """Get number of matches played by a fencer."""
        return self.match_counts.get(fencer, 0)

    def update_rating(self, fencer, rating_change, date, reason):
        """Update a fencer's rating and record history."""
        old_rating = self.get_rating(fencer)
        new_rating = apply_rating_bounds(old_rating + rating_change)
        self.ratings[fencer] = new_rating
        self.rating_history[fencer].append((date, new_rating, reason))

    def process_poule_match(self, fencer1, fencer2, score1, score2, date):
        """Process a poule match and update ratings."""
        old_rating1 = self.get_rating(fencer1)
        old_rating2 = self.get_rating(fencer2)

        # Calculate expected scores
        expected1 = calculate_expected_score(old_rating1, old_rating2)
        expected2 = calculate_expected_score(old_rating2, old_rating1)

        # Calculate actual scores (margin-adjusted)
        actual1 = calculate_poule_actual_score(score1, score2)
        actual2 = calculate_poule_actual_score(score2, score1)

        # Get K-factors
        k1 = get_k_factor(self.get_match_count(fencer1))
        k2 = get_k_factor(self.get_match_count(fencer2))

        # Calculate rating changes
        change1 = k1 * (actual1 - expected1)
        change2 = k2 * (actual2 - expected2)

        # Update ratings
        self.update_rating(fencer1, change1, date, f'Poule vs {fencer2} ({score1}-{score2})')
        self.update_rating(fencer2, change2, date, f'Poule vs {fencer1} ({score2}-{score1})')

        # Record match history
        new_rating1 = self.ratings[fencer1]
        new_rating2 = self.ratings[fencer2]
        self.match_history.append((
            date, fencer1, old_rating1, new_rating1, change1,
            fencer2, old_rating2, new_rating2, change2, f'Poule {score1}-{score2}'
        ))

        # Increment match counts
        self.match_counts[fencer1] = self.match_counts.get(fencer1, 0) + 1
        self.match_counts[fencer2] = self.match_counts.get(fencer2, 0) + 1

    def process_de_match(self, fencer1, fencer2, winner, bracket_name, date, total_fencers):
        """Process a DE match and update ratings."""
        old_rating1 = self.get_rating(fencer1)
        old_rating2 = self.get_rating(fencer2)

        # Calculate expected scores
        expected1 = calculate_expected_score(old_rating1, old_rating2)
        expected2 = calculate_expected_score(old_rating2, old_rating1)

        # Actual scores (binary: win=1, loss=0)
        actual1 = 1.0 if winner == fencer1 else 0.0
        actual2 = 1.0 if winner == fencer2 else 0.0

        # Get K-factors
        k1 = get_k_factor(self.get_match_count(fencer1))
        k2 = get_k_factor(self.get_match_count(fencer2))

        # Apply bracket weight and field size multiplier
        bracket_weight = get_bracket_weight(bracket_name)
        field_multiplier = get_field_size_multiplier(total_fencers)

        effective_k1 = k1 * bracket_weight * field_multiplier
        effective_k2 = k2 * bracket_weight * field_multiplier

        # Calculate rating changes
        change1 = effective_k1 * (actual1 - expected1)
        change2 = effective_k2 * (actual2 - expected2)

        # Update ratings
        result1 = "won" if winner == fencer1 else "lost"
        result2 = "won" if winner == fencer2 else "lost"
        self.update_rating(fencer1, change1, date, f'{bracket_name} vs {fencer2} ({result1})')
        self.update_rating(fencer2, change2, date, f'{bracket_name} vs {fencer1} ({result2})')

        # Record match history
        new_rating1 = self.ratings[fencer1]
        new_rating2 = self.ratings[fencer2]
        match_result = f'{bracket_name} ({winner} won)'
        self.match_history.append((
            date, fencer1, old_rating1, new_rating1, change1,
            fencer2, old_rating2, new_rating2, change2, match_result
        ))

        # Increment match counts
        self.match_counts[fencer1] = self.match_counts.get(fencer1, 0) + 1
        self.match_counts[fencer2] = self.match_counts.get(fencer2, 0) + 1

    def apply_placement_bonus(self, fencer, place, date):
        """Apply placement bonus for tournament finish."""
        if place in PLACEMENT_BONUSES:
            bonus = PLACEMENT_BONUSES[place]
            self.update_rating(fencer, bonus, date, f'Placement bonus ({place}st/nd/rd/th place)')


class MatchHistory:
    def __init__(self):
        # Structure: {(fencer1, fencer2): [(date, match_type, winner, score), ...]}
        self.matches = defaultdict(list)
        # Structure: {fencer_name: {placement_category: {place: count}}}
        self.placements = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
        # Structure: {fencer_name: [(date, seed), ...]}
        self.seedings = defaultdict(list)

    def add_match(self, fencer1, fencer2, date, match_type, winner, score=None):
        """Add a match to the history. Always store in alphabetical order."""
        if not fencer1 or not fencer2 or fencer1 == '_' or fencer2 == '_':
            return

        # Normalize names (strip and title case for consistency)
        fencer1 = fencer1.strip().title()
        fencer2 = fencer2.strip().title()
        winner_normalized = winner.strip().title() if winner else None

        # Sort pair alphabetically
        pair = tuple(sorted([fencer1, fencer2]))

        # If we flipped the order, we need to flip the score too
        # Score format is "fencer1_score-fencer2_score"
        adjusted_score = score
        if score and pair[0] != fencer1:
            # We flipped the order, so flip the score
            score_parts = score.split('-')
            if len(score_parts) == 2:
                adjusted_score = f"{score_parts[1]}-{score_parts[0]}"

        self.matches[pair].append({
            'date': date,
            'type': match_type,
            'winner': winner_normalized,
            'score': adjusted_score
        })

    def add_placement(self, fencer, place):
        """Add a placement result for a fencer."""
        if not fencer or fencer == '_':
            return

        # Normalize name (strip and title case)
        fencer = fencer.strip().title()

        # Categorize placement into power-of-2 groups
        if place == 1:
            category = 'Win'
        elif place == 2:
            category = 'L2'
        elif 3 <= place <= 4:
            category = 'L4'
        elif 5 <= place <= 8:
            category = 'L8'
        elif 9 <= place <= 16:
            category = 'L16'
        elif 17 <= place <= 32:
            category = 'L32'
        else:
            return

        # Store both category and specific place
        self.placements[fencer][category][place] += 1

    def add_seeding(self, fencer, seed, date):
        """Add a seeding result for a fencer."""
        if not fencer or fencer == '_':
            return

        # Normalize name (strip and title case)
        fencer = fencer.strip().title()
        self.seedings[fencer].append((date, seed))

    def get_history(self, fencer1, fencer2):
        """Get match history for a specific pair."""
        pair = tuple(sorted([fencer1.strip(), fencer2.strip()]))
        return self.matches.get(pair, [])

    def get_all_pairs(self):
        """Get all pairs with their match history."""
        return dict(self.matches)

    def get_all_placements(self):
        """Get all fencer placements."""
        return dict(self.placements)

    def get_fencer_stats(self, fencer):
        """Get comprehensive statistics for a single fencer."""
        # Normalize fencer name for lookup
        fencer = fencer.strip().title()

        stats = {
            'total_matches': 0,
            'wins': 0,
            'losses': 0,
            'winrate': 0.0,
            'poule_matches': 0,
            'poule_wins': 0,
            'poule_losses': 0,
            'poule_winrate': 0.0,
            'de_matches': 0,
            'de_wins': 0,
            'de_losses': 0,
            'de_winrate': 0.0,
            'touches_scored': 0,
            'touches_received': 0,
            'average_seeding': 0.0,
            'average_placement': 0.0,
            'placements': {}
        }

        # Calculate match statistics
        for (fencer1, fencer2), matches in self.matches.items():
            if fencer not in (fencer1, fencer2):
                continue

            for match in matches:
                stats['total_matches'] += 1

                is_poule = match['type'] == 'poule'
                is_de = 'DE' in match['type']

                if match['winner'] == fencer:
                    stats['wins'] += 1
                    if is_poule:
                        stats['poule_wins'] += 1
                    elif is_de:
                        stats['de_wins'] += 1
                else:
                    stats['losses'] += 1
                    if is_poule:
                        stats['poule_losses'] += 1
                    elif is_de:
                        stats['de_losses'] += 1

                if is_poule:
                    stats['poule_matches'] += 1
                elif is_de:
                    stats['de_matches'] += 1

                # Parse touches from score (only for poule matches)
                if match['score']:
                    score_parts = match['score'].split('-')
                    if len(score_parts) == 2:
                        try:
                            if fencer == fencer1:
                                # Fencer is first in pair
                                if fencer == match['winner']:
                                    stats['touches_scored'] += 5
                                    stats['touches_received'] += int(score_parts[1]) if score_parts[1] != '?' else 0
                                else:
                                    stats['touches_scored'] += int(score_parts[0]) if score_parts[0] != '?' else 0
                                    stats['touches_received'] += 5
                            else:
                                # Fencer is second in pair
                                if fencer == match['winner']:
                                    stats['touches_scored'] += 5
                                    stats['touches_received'] += int(score_parts[0]) if score_parts[0] != '?' else 0
                                else:
                                    stats['touches_scored'] += int(score_parts[1]) if score_parts[1] != '?' else 0
                                    stats['touches_received'] += 5
                        except (ValueError, IndexError):
                            pass

        # Calculate winrates
        if stats['total_matches'] > 0:
            stats['winrate'] = stats['wins'] / stats['total_matches']
        if stats['poule_matches'] > 0:
            stats['poule_winrate'] = stats['poule_wins'] / stats['poule_matches']
        if stats['de_matches'] > 0:
            stats['de_winrate'] = stats['de_wins'] / stats['de_matches']

        # Calculate average seeding
        if fencer in self.seedings and self.seedings[fencer]:
            avg_seed = sum(seed for _, seed in self.seedings[fencer]) / len(self.seedings[fencer])
            stats['average_seeding'] = avg_seed

        # Calculate average placement
        if fencer in self.placements:
            all_placements = []
            for category_placements in self.placements[fencer].values():
                for place, count in category_placements.items():
                    all_placements.extend([place] * count)

            if all_placements:
                stats['average_placement'] = sum(all_placements) / len(all_placements)

        # Store placement details
        if fencer in self.placements:
            stats['placements'] = dict(self.placements[fencer])

        return stats


def parse_poule_sheet(csv_path, date):
    """Parse a poule sheet and extract match results."""
    matches = []

    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            rows = list(reader)

        if len(rows) < 3:
            return matches

        # Row 0 has column headers (names)
        # Row 1 has numbers
        # Rows 2+ have the results

        # Get fencer names from first row (starting from column 2)
        header_names = rows[0][2:]  # Skip first two columns (empty, Name)

        # Parse each fencer's row - only process upper triangle to avoid duplicates
        for i, row in enumerate(rows[2:], start=0):
            if len(row) < 2:
                continue

            fencer_name = row[1]  # Column 1 has the fencer name
            if not fencer_name or fencer_name.strip() == '':
                continue

            # Only parse results for columns > current row (upper triangle)
            # This avoids counting each match twice
            for j in range(i + 1, len(header_names)):
                if j >= len(row) - 2:  # -2 because we skip first 2 columns
                    break

                opponent_name = header_names[j]
                if not opponent_name or opponent_name.strip() == '':
                    continue

                result = row[2 + j].strip() if len(row) > 2 + j else ''
                opponent_row_idx = j + 2  # +2 for header rows
                opponent_result = ''

                # Get opponent's result for this match
                if opponent_row_idx < len(rows):
                    opponent_row = rows[opponent_row_idx]
                    if len(opponent_row) > 2 + i:
                        opponent_result = opponent_row[2 + i].strip()

                # Build complete score from both sides
                if result and opponent_result:
                    if result == 'V' and opponent_result.isdigit():
                        # Fencer won 5-X
                        opp_score = int(opponent_result)
                        if 0 <= opp_score <= 4:
                            matches.append((fencer_name, opponent_name, date, 'poule', fencer_name, f'5-{opp_score}'))
                    elif result.isdigit() and opponent_result == 'V':
                        # Opponent won 5-X
                        fencer_score = int(result)
                        if 0 <= fencer_score <= 4:
                            matches.append((fencer_name, opponent_name, date, 'poule', opponent_name, f'{fencer_score}-5'))
                elif result and not opponent_result:
                    # Only one side has data
                    if result == 'V':
                        matches.append((fencer_name, opponent_name, date, 'poule', fencer_name, '5-?'))
                    elif result.isdigit():
                        score = int(result)
                        if 0 <= score <= 4:
                            matches.append((fencer_name, opponent_name, date, 'poule', opponent_name, f'{score}-5'))
                elif not result and opponent_result:
                    # Only opponent side has data
                    if opponent_result == 'V':
                        matches.append((fencer_name, opponent_name, date, 'poule', opponent_name, '?-5'))
                    elif opponent_result.isdigit():
                        score = int(opponent_result)
                        if 0 <= score <= 4:
                            matches.append((fencer_name, opponent_name, date, 'poule', fencer_name, f'5-{score}'))

    except Exception as e:
        print(f"Error parsing poule sheet {csv_path}: {e}")

    # Shuffle matches to avoid systematic ordering bias
    # Use date as seed for reproducibility
    if matches:
        random.seed(date)
        random.shuffle(matches)

    return matches


def parse_de_sheet(csv_path, date):
    """Parse a DE (Direct Elimination) bracket sheet.

    The DE sheet is a bracket layout where:
    - Columns come in pairs: (Name, Result) for each round
    - Rounds start at column 3: L32, L16, L8, Semi-final, Final
    - Rows are organized in pairs: row i and row i+1 represent one match
    - 'V' indicates the winner, empty means they lost
    - '_' indicates a bye (no opponent)

    Returns: (matches, placements, seedings)
    - matches: list of match tuples
    - placements: dict of {fencer: place}
    - seedings: dict of {fencer: seed}
    """
    matches = []
    placements = {}
    seedings = {}

    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            rows = list(reader)

        if len(rows) < 2:
            return matches, placements, seedings

        # Skip header row
        data_rows = rows[1:]

        # Extract placements from the "Winner" column (column 13)
        # Extract seedings from the "Place" column (column 0) - this is their seed from poules
        # Row number (starting from 1) = final placement

        for idx, row in enumerate(data_rows):
            if len(row) < 14:
                continue

            # Column 0 is "Place" - the seed (ranking from poules)
            seed_str = row[0].strip() if row[0] else ''
            fencer_name = row[1].strip() if row[1] else ''

            if seed_str and seed_str.isdigit() and fencer_name and fencer_name != '_':
                seedings[fencer_name] = int(seed_str)

            # Column 13 is "Winner" - contains the fencer who got this placement
            winner = row[13].strip() if row[13] else ''

            if winner and winner != '_':
                # Row index + 1 = placement (rows start at 0, placements start at 1)
                place = idx + 1
                placements[winner] = place

        # Process each round (pair of columns starting at column 3)
        # Column pairs: (3,4)=L32, (5,6)=L16, (7,8)=L8, (9,10)=Semi, (11,12)=Final
        round_starts = [3, 5, 7, 9, 11]  # Starting column for each round
        total_fencers = 32  # Standard bracket size

        for round_idx, col_start in enumerate(round_starts):
            name_col = col_start
            result_col = col_start + 1

            # Calculate bracket levels for this round
            # Round 0 (L32): 1 bracket of 32 → L1-32
            # Round 1 (L16): 2 brackets of 16 → L1-16, L17-32
            # Round 2 (L8): 4 brackets of 8 → L1-8, L9-16, L17-24, L25-32
            # Round 3 (Semi): 8 brackets of 4 → L1-4, L5-8, L9-12, L13-16, L17-20, L21-24, L25-28, L29-32
            # Round 4 (Final): 16 brackets of 2 → L1-2, L3-4, ..., L31-32

            num_brackets = 2 ** round_idx  # Number of brackets in this round
            bracket_size = total_fencers // num_brackets  # Fencers per bracket
            rows_per_bracket = bracket_size  # Each bracket has this many rows

            # Process ALL rows in consecutive pairs
            row_idx = 0
            while row_idx + 1 < len(data_rows):
                row1 = data_rows[row_idx]
                row2 = data_rows[row_idx + 1]

                # Extract fencer names and results from this round's columns
                fencer1 = row1[name_col].strip() if len(row1) > name_col and row1[name_col] else ''
                result1 = row1[result_col].strip() if len(row1) > result_col and row1[result_col] else ''

                fencer2 = row2[name_col].strip() if len(row2) > name_col and row2[name_col] else ''
                result2 = row2[result_col].strip() if len(row2) > result_col and row2[result_col] else ''

                # Only record if both fencers exist and neither is a bye
                if fencer1 and fencer2 and fencer1 != '_' and fencer2 != '_':
                    # Calculate which bracket this match is in based on row position
                    bracket_num = row_idx // rows_per_bracket
                    bracket_start = bracket_num * bracket_size + 1
                    bracket_end = (bracket_num + 1) * bracket_size
                    bracket_name = f'L{bracket_start}-{bracket_end}'

                    # Determine winner
                    winner = None
                    if result1 == 'V' and result2 != 'V':
                        winner = fencer1
                    elif result2 == 'V' and result1 != 'V':
                        winner = fencer2

                    if winner:
                        matches.append((fencer1, fencer2, date, f'DE-{bracket_name}', winner, None))

                # Move to next pair
                row_idx += 2

    except Exception as e:
        print(f"Error parsing DE sheet {csv_path}: {e}")

    return matches, placements, seedings


def calculate_session_stats(date, poule_matches, de_matches, all_fencers_poule, all_fencers_de, placements):
    """Calculate statistics for a single tournament session."""
    # Find winner (1st place finisher)
    winner = None
    for fencer, place in placements.items():
        if place == 1:
            winner = fencer
            break

    stats = {
        'date': date,
        'winner': winner if winner else 'Unknown',
        'fencers_in_poules': len(all_fencers_poule),
        'fencers_in_des': len(all_fencers_de),
        'total_matches': len(poule_matches) + len(de_matches),
        'poule_matches': len(poule_matches),
        'de_matches': len(de_matches),
        'score_5_0': 0,
        'score_5_1': 0,
        'score_5_2': 0,
        'score_5_3': 0,
        'score_5_4': 0,
        'score_unknown': 0,
        'total_touches_scored': 0,
        'total_touches_received': 0,
        'avg_touches_per_match': 0.0
    }

    # Analyze poule match scores
    for match in poule_matches:
        if match[5]:  # score exists
            score = match[5]
            score_parts = score.split('-')
            if len(score_parts) == 2:
                try:
                    left = int(score_parts[0]) if score_parts[0] != '?' else None
                    right = int(score_parts[1]) if score_parts[1] != '?' else None

                    if left is not None and right is not None:
                        # Count total touches
                        stats['total_touches_scored'] += left + right

                        # Categorize by winner's margin
                        if left == 5:
                            score_key = f'score_5_{right}'
                            if score_key in stats:
                                stats[score_key] += 1
                        elif right == 5:
                            score_key = f'score_5_{left}'
                            if score_key in stats:
                                stats[score_key] += 1
                    else:
                        stats['score_unknown'] += 1
                except (ValueError, IndexError):
                    stats['score_unknown'] += 1

    # Calculate average
    if stats['poule_matches'] > 0:
        stats['avg_touches_per_match'] = round(stats['total_touches_scored'] / stats['poule_matches'], 2)

    # Calculate touches received (inverse of scored in poules)
    stats['total_touches_received'] = stats['total_touches_scored']

    return stats


def process_all_sheets(base_dir='downloaded_sheets'):
    """Process all sheets and build match history with ELO ratings."""
    history = MatchHistory()
    elo_system = ELORatingSystem()
    session_stats = []

    base_path = Path(base_dir)
    if not base_path.exists():
        print(f"Directory {base_dir} not found")
        return history, session_stats, elo_system

    # Process each date folder in chronological order
    date_folders = [f for f in base_path.iterdir() if f.is_dir()]
    date_folders.sort()  # Sorts alphabetically, which works for YYYY-MM-DD format

    for date_folder in date_folders:
        if not date_folder.is_dir():
            continue

        date = date_folder.name
        print(f"Processing {date}...")

        # Find poule and DE sheets
        poule_sheet = None
        de_sheet = None

        for file in date_folder.iterdir():
            if file.suffix == '.csv':
                if '_DE.csv' in file.name:
                    de_sheet = file
                else:
                    poule_sheet = file

        # Track data for session stats
        poule_matches_data = []
        de_matches_data = []
        fencers_in_poules = set()
        fencers_in_des = set()
        placements = {}

        # Parse poule sheet
        if poule_sheet:
            matches = parse_poule_sheet(poule_sheet, date)
            poule_matches_data = matches
            for fencer1, fencer2, date_str, match_type, winner, score in matches:
                history.add_match(fencer1, fencer2, date_str, match_type, winner, score)
                fencers_in_poules.add(fencer1)
                fencers_in_poules.add(fencer2)

                # Process ELO for poule match
                if score:
                    try:
                        score_parts = score.split('-')
                        if len(score_parts) == 2:
                            score1 = int(score_parts[0]) if score_parts[0] != '?' else None
                            score2 = int(score_parts[1]) if score_parts[1] != '?' else None
                            if score1 is not None and score2 is not None:
                                elo_system.process_poule_match(fencer1, fencer2, score1, score2, date_str)
                    except (ValueError, IndexError):
                        pass

            print(f"  Found {len(matches)} poule matches")

        # Parse DE sheet
        if de_sheet:
            matches, placements, seedings = parse_de_sheet(de_sheet, date)
            de_matches_data = matches

            # Count total fencers for field size scaling
            total_fencers = len(fencers_in_poules) if fencers_in_poules else len(placements)

            for fencer1, fencer2, date_str, match_type, winner, score in matches:
                history.add_match(fencer1, fencer2, date_str, match_type, winner, score)
                fencers_in_des.add(fencer1)
                fencers_in_des.add(fencer2)

                # Process ELO for DE match
                # Extract bracket name from match_type (format: "DE-L1-8")
                bracket_name = match_type.replace('DE-', '') if match_type.startswith('DE-') else 'L1-32'
                elo_system.process_de_match(fencer1, fencer2, winner, bracket_name, date_str, total_fencers)

            for fencer, place in placements.items():
                history.add_placement(fencer, place)
                # Apply placement bonus
                elo_system.apply_placement_bonus(fencer, place, date)

            for fencer, seed in seedings.items():
                history.add_seeding(fencer, seed, date)
                fencers_in_des.add(fencer)

            print(f"  Found {len(matches)} DE matches")
            print(f"  Found {len(placements)} placements")

        # Calculate session stats
        session_stat = calculate_session_stats(
            date, poule_matches_data, de_matches_data,
            fencers_in_poules, fencers_in_des, placements
        )
        session_stats.append(session_stat)

    return history, session_stats, elo_system


def print_match_history(history, min_matches=1):
    """Print match history for all pairs."""
    all_pairs = history.get_all_pairs()

    print(f"\n{'='*80}")
    print(f"MATCH HISTORY SUMMARY")
    print(f"{'='*80}\n")

    # Sort by number of matches (descending)
    sorted_pairs = sorted(all_pairs.items(), key=lambda x: len(x[1]), reverse=True)

    for (fencer1, fencer2), matches in sorted_pairs:
        if len(matches) < min_matches:
            continue

        print(f"\n{fencer1} vs {fencer2}")
        print(f"{'-'*60}")

        # Count wins
        wins = {fencer1: 0, fencer2: 0}
        for match in matches:
            if match['winner'] in wins:
                wins[match['winner']] += 1

        print(f"Total matches: {len(matches)}")
        print(f"  {fencer1}: {wins[fencer1]} wins")
        print(f"  {fencer2}: {wins[fencer2]} wins")
        print(f"\nMatch details:")

        for match in sorted(matches, key=lambda x: x['date']):
            score_str = f" ({match['score']})" if match['score'] else ""
            print(f"  {match['date']} - {match['type']:6s} - Winner: {match['winner']}{score_str}")


def print_placement_stats(history):
    """Print placement statistics for all fencers."""
    placements = history.get_all_placements()

    if not placements:
        return

    print(f"\n{'='*80}")
    print(f"PLACEMENT STATISTICS")
    print(f"{'='*80}\n")

    # Sort fencers by total number of tournaments
    fencer_stats = []
    for fencer, cats in placements.items():
        total = sum(sum(place_counts.values()) for place_counts in cats.values())
        fencer_stats.append((fencer, cats, total))

    fencer_stats.sort(key=lambda x: (-x[2], x[0]))  # Sort by total desc, then name

    for fencer, cats, total in fencer_stats:
        print(f"{fencer}:")

        # Order: Win, L2, L4, L8, L16, L32
        for category in ['Win', 'L2', 'L4', 'L8', 'L16', 'L32']:
            if category in cats and cats[category]:
                # Get total for this category
                cat_total = sum(cats[category].values())

                # Build detail string: "place:count, place:count, ..."
                place_details = []
                for place in sorted(cats[category].keys()):
                    count = cats[category][place]
                    place_details.append(f"{place}:{count}")

                detail_str = ", ".join(place_details)
                print(f"  {category} = {cat_total} ({detail_str})")

        print()  # Blank line after each fencer


def export_to_csv(history, output_file='match_history.csv'):
    """Export match history to CSV with duplicate entries for each fencer."""
    all_pairs = history.get_all_pairs()

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Fencer 1', 'Fencer 2', 'Date', 'Match Type', 'Winner', 'Score'])

        for (fencer1, fencer2), matches in sorted(all_pairs.items()):
            for match in sorted(matches, key=lambda x: x['date']):
                # Write the match once as fencer1 vs fencer2
                writer.writerow([
                    fencer1,
                    fencer2,
                    match['date'],
                    match['type'],
                    match['winner'],
                    match['score'] if match['score'] else ''
                ])
                # Write it again as fencer2 vs fencer1
                writer.writerow([
                    fencer2,
                    fencer1,
                    match['date'],
                    match['type'],
                    match['winner'],
                    match['score'] if match['score'] else ''
                ])

    print(f"\n✓ Match history exported to {output_file}")


def export_placements_to_csv(history, output_file='placement_stats.csv'):
    """Export placement statistics to CSV."""
    placements = history.get_all_placements()

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Fencer', 'Total', 'Win', 'L2', 'L4', 'L8', 'L16', 'L32'])

        for fencer in sorted(placements.keys()):
            cats = placements[fencer]

            # Calculate total appearances across all categories
            total_appearances = sum(sum(place_counts.values()) for place_counts in cats.values())

            row = [fencer, total_appearances]

            # For each category, build the cell content: "total (place:count, place:count, ...)"
            for category in ['Win', 'L2', 'L4', 'L8', 'L16', 'L32']:
                if category in cats and cats[category]:
                    # Get total for this category
                    cat_total = sum(cats[category].values())

                    # For Win and L2, just show the count as a number (placement is implied)
                    if category in ['Win', 'L2']:
                        cell_value = cat_total
                    else:
                        # Build detail string: "place:count, place:count, ..."
                        place_details = []
                        for place in sorted(cats[category].keys()):
                            count = cats[category][place]
                            place_details.append(f"{place}:{count}")

                        detail_str = ", ".join(place_details)
                        cell_value = f"{cat_total} ({detail_str})"

                    row.append(cell_value)
                else:
                    row.append(0)

            writer.writerow(row)

    print(f"✓ Placement statistics exported to {output_file}")


def export_fencer_stats(history, output_file='fencer_stats.csv'):
    """Export individual fencer statistics to CSV."""
    # Get all unique fencers
    all_fencers = set()
    for (fencer1, fencer2) in history.get_all_pairs().keys():
        all_fencers.add(fencer1)
        all_fencers.add(fencer2)

    # Also add fencers who might only have placements
    all_fencers.update(history.get_all_placements().keys())

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Fencer', 'Total Appearances',
            'Total Matches', 'Wins', 'Losses', 'Winrate',
            'Poule Matches', 'Poule Wins', 'Poule Losses', 'Poule Winrate',
            'Touches Scored', 'Touches Received', 'Touch Differential',
            'DE Appearances',
            'DE Matches', 'DE Wins', 'DE Losses', 'DE Winrate',
            'Avg Seeding', 'Avg Placement',
            'Win', 'L2', 'L4', 'L8', 'L16', 'L32'
        ])

        for fencer in sorted(all_fencers):
            stats = history.get_fencer_stats(fencer)

            # Calculate total appearances as unique dates where fencer participated
            appearance_dates = set()

            # Add dates from matches
            for (fencer1, fencer2), matches in history.get_all_pairs().items():
                if fencer in (fencer1, fencer2):
                    for match in matches:
                        appearance_dates.add(match['date'])

            # Add dates from seedings
            if fencer in history.seedings:
                for date, _ in history.seedings[fencer]:
                    appearance_dates.add(date)

            total_appearances = len(appearance_dates)

            # Calculate DE appearances (dates where they have a seeding = participated in DEs)
            de_appearance_dates = set()
            if fencer in history.seedings:
                for date, _ in history.seedings[fencer]:
                    de_appearance_dates.add(date)

            de_appearances = len(de_appearance_dates)

            # Format placement data like in placement_stats.csv
            placement_cols = []
            for category in ['Win', 'L2', 'L4', 'L8', 'L16', 'L32']:
                if category in stats['placements'] and stats['placements'][category]:
                    cat_total = sum(stats['placements'][category].values())

                    # For Win and L2, just show the count as a number
                    if category in ['Win', 'L2']:
                        placement_cols.append(cat_total)
                    else:
                        # Build detail string (must be string due to formatting)
                        place_details = []
                        for place in sorted(stats['placements'][category].keys()):
                            count = stats['placements'][category][place]
                            place_details.append(f"{place}:{count}")

                        detail_str = ", ".join(place_details)
                        placement_cols.append(f"{cat_total} ({detail_str})")
                else:
                    placement_cols.append(0)

            touch_diff = stats['touches_scored'] - stats['touches_received']

            writer.writerow([
                fencer,
                total_appearances,
                stats['total_matches'],
                stats['wins'],
                stats['losses'],
                round(stats['winrate'], 3) if stats['total_matches'] > 0 else 0,
                stats['poule_matches'],
                stats['poule_wins'],
                stats['poule_losses'],
                round(stats['poule_winrate'], 3) if stats['poule_matches'] > 0 else 0,
                stats['touches_scored'],
                stats['touches_received'],
                touch_diff,
                de_appearances,
                stats['de_matches'],
                stats['de_wins'],
                stats['de_losses'],
                round(stats['de_winrate'], 3) if stats['de_matches'] > 0 else 0,
                round(stats['average_seeding'], 2) if de_appearances > 0 else 0.0,
                round(stats['average_placement'], 2) if de_appearances > 0 else 0.0,
            ] + placement_cols)

    print(f"✓ Fencer statistics exported to {output_file}")


def export_head_to_head_stats(history, output_file='head_to_head_stats.csv'):
    """Export head-to-head matchup statistics to CSV."""
    all_pairs = history.get_all_pairs()

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Fencer 1', 'Fencer 2',
            'Total Matches',
            'Fencer 1 Wins', 'Fencer 2 Wins',
            'Fencer 1 Win%', 'Fencer 2 Win%',
            'Poule Matches',
            'Fencer 1 Poule Wins', 'Fencer 2 Poule Wins',
            'DE Matches',
            'Fencer 1 DE Wins', 'Fencer 2 DE Wins',
            'Fencer 1 Touches Scored', 'Fencer 2 Touches Scored',
            'Touch Differential (F1 - F2)',
            'First Match Date', 'Last Match Date'
        ])

        for (fencer1, fencer2), matches in sorted(all_pairs.items()):
            # Calculate overall stats
            total_matches = len(matches)
            f1_wins = sum(1 for m in matches if m['winner'] == fencer1)
            f2_wins = sum(1 for m in matches if m['winner'] == fencer2)
            f1_win_pct = round(f1_wins / total_matches, 3) if total_matches > 0 else 0
            f2_win_pct = round(f2_wins / total_matches, 3) if total_matches > 0 else 0

            # Calculate poule stats
            poule_matches = [m for m in matches if m['type'] == 'poule']
            poule_count = len(poule_matches)
            f1_poule_wins = sum(1 for m in poule_matches if m['winner'] == fencer1)
            f2_poule_wins = sum(1 for m in poule_matches if m['winner'] == fencer2)

            # Calculate DE stats
            de_matches = [m for m in matches if 'DE' in m['type']]
            de_count = len(de_matches)
            f1_de_wins = sum(1 for m in de_matches if m['winner'] == fencer1)
            f2_de_wins = sum(1 for m in de_matches if m['winner'] == fencer2)

            # Calculate touch stats (from poule matches only)
            f1_touches_scored = 0
            f2_touches_scored = 0
            f1_touches_received = 0
            f2_touches_received = 0

            for match in poule_matches:
                if match['score']:
                    score_parts = match['score'].split('-')
                    if len(score_parts) == 2:
                        try:
                            # Score is stored as "fencer1_score-fencer2_score" (in alphabetical order)
                            f1_score = int(score_parts[0]) if score_parts[0] != '?' else 0
                            f2_score = int(score_parts[1]) if score_parts[1] != '?' else 0

                            f1_touches_scored += f1_score
                            f2_touches_scored += f2_score
                        except (ValueError, IndexError):
                            pass

            touch_diff = f1_touches_scored - f2_touches_scored

            # Get first and last match dates
            sorted_matches = sorted(matches, key=lambda x: x['date'])
            first_date = sorted_matches[0]['date']
            last_date = sorted_matches[-1]['date']

            # Write the matchup as fencer1 vs fencer2
            writer.writerow([
                fencer1, fencer2,
                total_matches,
                f1_wins, f2_wins,
                f1_win_pct, f2_win_pct,
                poule_count,
                f1_poule_wins, f2_poule_wins,
                de_count,
                f1_de_wins, f2_de_wins,
                f1_touches_scored, f2_touches_scored,
                touch_diff,
                first_date, last_date
            ])

            # Write it again as fencer2 vs fencer1 (reversed)
            writer.writerow([
                fencer2, fencer1,
                total_matches,
                f2_wins, f1_wins,
                f2_win_pct, f1_win_pct,
                poule_count,
                f2_poule_wins, f1_poule_wins,
                de_count,
                f2_de_wins, f1_de_wins,
                f2_touches_scored, f1_touches_scored,
                -touch_diff,  # Flip the differential
                first_date, last_date
            ])

    print(f"✓ Head-to-head statistics exported to {output_file}")


def export_session_stats(session_stats, output_file='session_stats.csv'):
    """Export per-session tournament statistics."""

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)

        # Write session statistics header
        writer.writerow([
            'Date',
            'Winner',
            'Fencers in Poules',
            'Fencers in DEs',
            'Total Matches',
            'Poule Matches',
            'DE Matches',
            '5-0 Scores',
            '5-1 Scores',
            '5-2 Scores',
            '5-3 Scores',
            '5-4 Scores',
            'Unknown Scores',
            'Total Touches',
            'Avg Touches/Match'
        ])

        for stat in session_stats:
            writer.writerow([
                stat['date'],
                stat['winner'],
                stat['fencers_in_poules'],
                stat['fencers_in_des'],
                stat['total_matches'],
                stat['poule_matches'],
                stat['de_matches'],
                stat['score_5_0'],
                stat['score_5_1'],
                stat['score_5_2'],
                stat['score_5_3'],
                stat['score_5_4'],
                stat['score_unknown'],
                stat['total_touches_scored'],
                stat['avg_touches_per_match']
            ])

    print(f"✓ Session statistics exported to {output_file}")


def export_global_stats(session_stats, output_file='global_stats.txt'):
    """Export global tournament statistics to text file."""

    # Calculate global statistics
    total_sessions = len(session_stats)
    total_fencers_poule = sum(s['fencers_in_poules'] for s in session_stats)
    total_fencers_de = sum(s['fencers_in_des'] for s in session_stats)
    total_matches = sum(s['total_matches'] for s in session_stats)
    total_poule = sum(s['poule_matches'] for s in session_stats)
    total_de = sum(s['de_matches'] for s in session_stats)
    total_touches = sum(s['total_touches_scored'] for s in session_stats)

    total_5_0 = sum(s['score_5_0'] for s in session_stats)
    total_5_1 = sum(s['score_5_1'] for s in session_stats)
    total_5_2 = sum(s['score_5_2'] for s in session_stats)
    total_5_3 = sum(s['score_5_3'] for s in session_stats)
    total_5_4 = sum(s['score_5_4'] for s in session_stats)
    total_unknown = sum(s['score_unknown'] for s in session_stats)

    avg_fencers_poule = round(total_fencers_poule / total_sessions, 2) if total_sessions > 0 else 0
    avg_fencers_de = round(total_fencers_de / total_sessions, 2) if total_sessions > 0 else 0
    avg_matches_per_session = round(total_matches / total_sessions, 2) if total_sessions > 0 else 0
    avg_poule_per_session = round(total_poule / total_sessions, 2) if total_sessions > 0 else 0
    avg_de_per_session = round(total_de / total_sessions, 2) if total_sessions > 0 else 0
    avg_touches_overall = round(total_touches / total_poule, 2) if total_poule > 0 else 0

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("=" * 60 + "\n")
        f.write("Overall Haverstock Fencing Statistics \n")
        f.write("=" * 60 + "\n\n")

        f.write("--- SUMMARY ---\n")
        f.write(f"Total Sessions: {total_sessions}\n")
        f.write(f"Total Matches: {total_matches}\n")
        f.write(f"Total Poule Matches: {total_poule}\n")
        f.write(f"Total DE Matches: {total_de}\n")
        f.write(f"Total Touches Scored: {total_touches}\n\n")

        f.write("--- AVERAGES ---\n")
        f.write(f"Avg Fencers per Session (Poules): {avg_fencers_poule}\n")
        f.write(f"Avg Fencers per Session (DEs): {avg_fencers_de}\n")
        f.write(f"Avg Matches per Session: {avg_matches_per_session}\n")
        f.write(f"Avg Poule Matches per Session: {avg_poule_per_session}\n")
        f.write(f"Avg DE Matches per Session: {avg_de_per_session}\n")
        f.write(f"Avg Touches per Poule Match: {avg_touches_overall}\n\n")

        f.write("--- SCORE DISTRIBUTION (POULES) ---\n")
        if total_poule > 0:
            f.write(f"5-0:              {total_5_0:4d} ({round(100 * total_5_0 / total_poule, 1)}%)\n")
            f.write(f"5-1:              {total_5_1:4d} ({round(100 * total_5_1 / total_poule, 1)}%)\n")
            f.write(f"5-2:              {total_5_2:4d} ({round(100 * total_5_2 / total_poule, 1)}%)\n")
            f.write(f"5-3:              {total_5_3:4d} ({round(100 * total_5_3 / total_poule, 1)}%)\n")
            f.write(f"5-4:              {total_5_4:4d} ({round(100 * total_5_4 / total_poule, 1)}%)\n")
            f.write(f"Unknown:          {total_unknown:4d} ({round(100 * total_unknown / total_poule, 1)}%)\n\n")

        if total_sessions > 0 and avg_fencers_poule > 0:
            de_participation = round(100 * avg_fencers_de / avg_fencers_poule, 1)
            f.write(f"--- DE PARTICIPATION ---\n")
            f.write(f"Avg DE Participation Rate: {de_participation}%\n")

    print(f"✓ Global statistics exported to {output_file}")


def export_elo_ratings(elo_system, output_file='elo_ratings.csv'):
    """Export final ELO ratings for all fencers."""

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)

        # Write header
        writer.writerow([
            'Fencer',
            'Final ELO Rating',
            'Total Matches',
            'K-Factor',
            'Status'
        ])

        # Separate established and provisional ratings
        established = []
        provisional = []

        for fencer, rating in elo_system.ratings.items():
            match_count = elo_system.get_match_count(fencer)
            k_factor = get_k_factor(match_count)
            status = 'Established' if match_count >= MIN_MATCHES_FOR_ESTABLISHED else 'Provisional'

            entry = (fencer, rating, match_count, k_factor, status)

            if match_count >= MIN_MATCHES_FOR_ESTABLISHED:
                established.append(entry)
            else:
                provisional.append(entry)

        # Sort each group by rating (descending)
        established.sort(key=lambda x: x[1], reverse=True)
        provisional.sort(key=lambda x: x[1], reverse=True)

        # Write established ratings first
        for fencer, rating, match_count, k_factor, status in established:
            writer.writerow([
                fencer,
                round(rating, 1),
                match_count,
                k_factor,
                status
            ])

        # Then provisional ratings
        for fencer, rating, match_count, k_factor, status in provisional:
            writer.writerow([
                fencer,
                round(rating, 1),
                match_count,
                k_factor,
                status
            ])

    print(f"✓ ELO ratings exported to {output_file}")


def export_elo_history(elo_system, output_file='elo_history.csv'):
    """Export chronological ELO rating history showing both fencers per match.
    Winner is always in Fencer 1 position."""

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)

        # Write header
        writer.writerow([
            'Date',
            'Match Type',
            'Result',
            'Winner',
            'Winner Old Rating',
            'Winner New Rating',
            'Winner Change',
            'Loser',
            'Loser Old Rating',
            'Loser New Rating',
            'Loser Change'
        ])

        # Match history is already chronologically ordered
        for (date, fencer1, old_rating1, new_rating1, change1,
             fencer2, old_rating2, new_rating2, change2, match_type) in elo_system.match_history:

            # Parse match type to extract bracket/type and winner
            # Format: "Poule 5-3" or "L1-2 (Greg won)"
            winner_name = None
            if match_type.startswith('Poule'):
                # Poule match: extract score
                parts = match_type.split()
                if len(parts) >= 2:
                    score = parts[1]  # e.g., "5-3"
                    score_parts = score.split('-')
                    if len(score_parts) == 2:
                        score1 = score_parts[0]
                        score2 = score_parts[1]
                        # Determine winner by score
                        if int(score1) > int(score2):
                            winner_name = fencer1
                            result = f"(W) {fencer1} {score1}-{score2} {fencer2}"
                        else:
                            winner_name = fencer2
                            result = f"(W) {fencer2} {score2}-{score1} {fencer1}"
                        bracket_type = "Poule"
                    else:
                        result = f"{fencer1} - {fencer2}"
                        bracket_type = "Poule"
                else:
                    result = f"{fencer1} - {fencer2}"
                    bracket_type = "Poule"
            else:
                # DE match: extract bracket and winner
                # Format: "L1-2 (Greg won)"
                if '(' in match_type:
                    bracket = match_type.split('(')[0].strip()
                    winner_text = match_type.split('(')[1].rstrip(')')
                    winner_name = winner_text.replace(' won', '')

                    if winner_name == fencer1:
                        result = f"(W) {fencer1} - {fencer2}"
                    else:
                        result = f"(W) {fencer2} - {fencer1}"
                    bracket_type = bracket
                else:
                    result = f"{fencer1} - {fencer2}"
                    bracket_type = match_type

            # Reorder so winner is always first
            if winner_name == fencer1 or winner_name is None:
                # Winner is fencer1 or unknown, keep order
                writer.writerow([
                    date,
                    bracket_type,
                    result,
                    fencer1,
                    round(old_rating1, 1),
                    round(new_rating1, 1),
                    round(change1, 1),
                    fencer2,
                    round(old_rating2, 1),
                    round(new_rating2, 1),
                    round(change2, 1)
                ])
            else:
                # Winner is fencer2, swap order
                writer.writerow([
                    date,
                    bracket_type,
                    result,
                    fencer2,
                    round(old_rating2, 1),
                    round(new_rating2, 1),
                    round(change2, 1),
                    fencer1,
                    round(old_rating1, 1),
                    round(new_rating1, 1),
                    round(change1, 1)
                ])

    print(f"✓ ELO history exported to {output_file}")


def process_single_date(date_folder, base_dir='downloaded_sheets'):
    """Process a single date folder for debugging."""
    history = MatchHistory()
    session_stats = []

    date_path = Path(base_dir) / date_folder
    if not date_path.exists():
        print(f"Date folder {date_folder} not found")
        return history, session_stats

    date = date_folder
    print(f"Processing {date}...")

    # Find poule and DE sheets
    poule_sheet = None
    de_sheet = None

    for file in date_path.iterdir():
        if file.suffix == '.csv':
            if '_DE.csv' in file.name:
                de_sheet = file
            else:
                poule_sheet = file

    # Track data for session stats
    poule_matches_data = []
    de_matches_data = []
    fencers_in_poules = set()
    fencers_in_des = set()
    placements = {}

    # Parse poule sheet
    if poule_sheet:
        print(f"\nParsing poule sheet: {poule_sheet.name}")
        matches = parse_poule_sheet(poule_sheet, date)
        poule_matches_data = matches
        for fencer1, fencer2, date, match_type, winner, score in matches:
            history.add_match(fencer1, fencer2, date, match_type, winner, score)
            fencers_in_poules.add(fencer1)
            fencers_in_poules.add(fencer2)
        print(f"  Found {len(matches)} poule matches")

    # Parse DE sheet
    if de_sheet:
        print(f"\nParsing DE sheet: {de_sheet.name}")
        matches, placements, seedings = parse_de_sheet(de_sheet, date)
        de_matches_data = matches
        for fencer1, fencer2, date, match_type, winner, score in matches:
            history.add_match(fencer1, fencer2, date, match_type, winner, score)
            fencers_in_des.add(fencer1)
            fencers_in_des.add(fencer2)
        for fencer, place in placements.items():
            history.add_placement(fencer, place)
        for fencer, seed in seedings.items():
            history.add_seeding(fencer, seed, date)
            fencers_in_des.add(fencer)
        print(f"  Found {len(matches)} DE matches")
        print(f"  Found {len(placements)} placements")

    # Calculate session stats
    session_stat = calculate_session_stats(
        date, poule_matches_data, de_matches_data,
        fencers_in_poules, fencers_in_des, placements
    )
    session_stats.append(session_stat)

    return history, session_stats


def main():
    # Process all dates
    print("Processing all fencing sheets with ELO rating system...\n")
    print(f"ELO Configuration:")
    print(f"  Base K-Factor: {BASE_K}")
    print(f"  Starting Rating: {STARTING_RATING}")
    print(f"  Rating Range: {RATING_FLOOR} - {RATING_CEILING}")
    print(f"  Margin Scoring: {USE_MARGIN_SCORING}")
    print(f"  Field Size Baseline: {FIELD_SIZE_BASELINE}")
    print()

    history, session_stats, elo_system = process_all_sheets()

    # Print summary
    all_pairs = history.get_all_pairs()
    total_matches = sum(len(matches) for matches in all_pairs.values())
    print(f"\n{'='*80}")
    print(f"Found {len(all_pairs)} unique fencer pairs")
    print(f"Total matches recorded: {total_matches}")
    print(f"Total sessions: {len(session_stats)}")
    print(f"Total rated fencers: {len(elo_system.ratings)}")
    print(f"{'='*80}")

    # Create outputs directory
    output_dir = Path('outputs')
    output_dir.mkdir(exist_ok=True)

    # Export match history and stats
    export_to_csv(history, output_dir / 'match_history.csv')
    export_placements_to_csv(history, output_dir / 'placement_stats.csv')
    export_fencer_stats(history, output_dir / 'fencer_stats.csv')
    export_head_to_head_stats(history, output_dir / 'head_to_head_stats.csv')
    export_session_stats(session_stats, output_dir / 'session_stats.csv')
    export_global_stats(session_stats, output_dir / 'global_stats.txt')

    # Export ELO ratings
    export_elo_ratings(elo_system, output_dir / 'elo_ratings.csv')
    export_elo_history(elo_system, output_dir / 'elo_history.csv')


if __name__ == '__main__':
    main()
