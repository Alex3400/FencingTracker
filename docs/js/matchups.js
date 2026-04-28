// Head-to-head matchup analyzer
let ratingsData = [];
let h2hData = [];
let matchHistoryData = [];

async function loadData() {
    try {
        const [ratingsResponse, h2hResponse, historyResponse] = await Promise.all([
            fetch('data/elo_ratings.json'),
            fetch('data/head_to_head.json'),
            fetch('data/elo_history.csv')
        ]);

        ratingsData = await ratingsResponse.json();
        h2hData = await h2hResponse.json();

        // Parse CSV
        const historyText = await historyResponse.text();
        matchHistoryData = parseCSV(historyText);

        populateSelects();

        return Promise.resolve();
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading matchup data. Please try again later.');
        return Promise.reject(error);
    }
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    return lines.slice(1).map(line => {
        const values = line.split(',');
        const row = {};

        // CSV has exactly 11 columns
        row['Date'] = values[0];
        row['Match Type'] = values[1];
        row['Result'] = values[2];
        row['Winner'] = values[3];
        row['Winner Old Rating'] = values[4];
        row['Winner New Rating'] = values[5];
        row['Winner Change'] = values[6];
        row['Loser'] = values[7];
        row['Loser Old Rating'] = values[8];
        row['Loser New Rating'] = values[9];
        row['Loser Change'] = values[10];

        return row;
    });
}

function populateSelects() {
    const select1 = document.getElementById('fencer1-select');
    const select2 = document.getElementById('fencer2-select');

    // Sort fencers alphabetically
    const sortedFencers = [...ratingsData].sort((a, b) => a.fencer.localeCompare(b.fencer));

    sortedFencers.forEach(fencer => {
        const option1 = document.createElement('option');
        option1.value = fencer.fencer;
        option1.textContent = `${fencer.fencer} (${fencer.rating})`;
        select1.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = fencer.fencer;
        option2.textContent = `${fencer.fencer} (${fencer.rating})`;
        select2.appendChild(option2);
    });
}

function analyzeMatchup() {
    const fencer1 = document.getElementById('fencer1-select').value;
    const fencer2 = document.getElementById('fencer2-select').value;

    if (!fencer1 || !fencer2) {
        alert('Please select both fencers');
        return;
    }

    if (fencer1 === fencer2) {
        alert('Please select two different fencers');
        return;
    }

    // Find matchup data
    const matchup = h2hData.find(m =>
        (m.fencer1 === fencer1 && m.fencer2 === fencer2) ||
        (m.fencer1 === fencer2 && m.fencer2 === fencer1)
    );

    if (!matchup) {
        document.getElementById('results-section').style.display = 'none';
        document.getElementById('no-matches').style.display = 'block';
        return;
    }

    document.getElementById('no-matches').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';

    // Reorient data so fencer1 is always the selected first fencer
    let f1Name, f2Name, f1Wins, f2Wins, f1PouleWins, f2PouleWins, f1DEWins, f2DEWins;
    if (matchup.fencer1 === fencer1) {
        f1Name = matchup.fencer1;
        f2Name = matchup.fencer2;
        f1Wins = matchup.fencer1_wins;
        f2Wins = matchup.fencer2_wins;
        f1PouleWins = matchup.fencer1_poule_wins;
        f2PouleWins = matchup.fencer2_poule_wins;
        f1DEWins = matchup.fencer1_de_wins;
        f2DEWins = matchup.fencer2_de_wins;
    } else {
        f1Name = matchup.fencer2;
        f2Name = matchup.fencer1;
        f1Wins = matchup.fencer2_wins;
        f2Wins = matchup.fencer1_wins;
        f1PouleWins = matchup.fencer2_poule_wins;
        f2PouleWins = matchup.fencer1_poule_wins;
        f1DEWins = matchup.fencer2_de_wins;
        f2DEWins = matchup.fencer1_de_wins;
    }

    // Get current ratings
    const f1Rating = ratingsData.find(f => f.fencer === f1Name);
    const f2Rating = ratingsData.find(f => f.fencer === f2Name);

    // Calculate expected outcome (ELO formula)
    const f1Expected = 1 / (1 + Math.pow(10, (f2Rating.rating - f1Rating.rating) / 400));
    const f2Expected = 1 - f1Expected;

    // Display overall stats
    const totalMatches = matchup.total_matches;
    document.getElementById('overall-stats').innerHTML = `
        <div class="matchup-row">
            <span class="fencer-name">${f1Name}:</span>
            <span class="stat-value">${f1Wins} wins (${(f1Wins/totalMatches*100).toFixed(1)}%)</span>
        </div>
        <div class="matchup-row">
            <span class="fencer-name">${f2Name}:</span>
            <span class="stat-value">${f2Wins} wins (${(f2Wins/totalMatches*100).toFixed(1)}%)</span>
        </div>
        <div class="matchup-row total">
            <span>Total Matches:</span>
            <span class="stat-value">${totalMatches}</span>
        </div>
    `;

    // Display rating stats
    document.getElementById('rating-stats').innerHTML = `
        <div class="matchup-row">
            <span class="fencer-name">${f1Name}:</span>
            <span class="stat-value">${f1Rating.rating}</span>
        </div>
        <div class="matchup-row">
            <span class="fencer-name">${f2Name}:</span>
            <span class="stat-value">${f2Rating.rating}</span>
        </div>
        <div class="matchup-row total">
            <span>Rating Difference:</span>
            <span class="stat-value">${Math.abs(f1Rating.rating - f2Rating.rating).toFixed(1)} pts</span>
        </div>
    `;

    // Display poule stats
    const pouleMatches = matchup.poule_matches;
    if (pouleMatches > 0) {
        document.getElementById('poule-stats').innerHTML = `
            <div class="matchup-row">
                <span class="fencer-name">${f1Name}:</span>
                <span class="stat-value">${f1PouleWins} wins (${(f1PouleWins/pouleMatches*100).toFixed(1)}%)</span>
            </div>
            <div class="matchup-row">
                <span class="fencer-name">${f2Name}:</span>
                <span class="stat-value">${f2PouleWins} wins (${(f2PouleWins/pouleMatches*100).toFixed(1)}%)</span>
            </div>
            <div class="matchup-row total">
                <span>Total Poule:</span>
                <span class="stat-value">${pouleMatches}</span>
            </div>
        `;
    } else {
        document.getElementById('poule-stats').innerHTML = '<p class="no-data-text">No poule matches</p>';
    }

    // Display DE stats
    const deMatches = matchup.de_matches;
    if (deMatches > 0) {
        document.getElementById('de-stats').innerHTML = `
            <div class="matchup-row">
                <span class="fencer-name">${f1Name}:</span>
                <span class="stat-value">${f1DEWins} wins (${(f1DEWins/deMatches*100).toFixed(1)}%)</span>
            </div>
            <div class="matchup-row">
                <span class="fencer-name">${f2Name}:</span>
                <span class="stat-value">${f2DEWins} wins (${(f2DEWins/deMatches*100).toFixed(1)}%)</span>
            </div>
            <div class="matchup-row total">
                <span>Total DE:</span>
                <span class="stat-value">${deMatches}</span>
            </div>
        `;
    } else {
        document.getElementById('de-stats').innerHTML = '<p class="no-data-text">No DE matches</p>';
    }

    // Display detailed match history
    displayMatchHistory(f1Name, f2Name);
}

function displayMatchHistory(fencer1, fencer2) {
    const matchHistorySection = document.getElementById('match-history-section');
    const tbody = document.getElementById('match-history-body');
    tbody.innerHTML = '';

    // Filter matches involving both fencers
    const matches = matchHistoryData.filter(match =>
        (match.Winner === fencer1 && match.Loser === fencer2) ||
        (match.Winner === fencer2 && match.Loser === fencer1)
    );

    if (matches.length === 0) {
        matchHistorySection.style.display = 'none';
        return;
    }

    matchHistorySection.style.display = 'block';

    // Display matches chronologically
    matches.forEach(match => {
        const row = document.createElement('tr');

        // Determine which fencer is which in this match
        const f1IsWinner = match['Winner'] === fencer1;
        const winner = f1IsWinner ? fencer1 : fencer2;
        const loser = f1IsWinner ? fencer2 : fencer1;

        const winnerOldRating = parseFloat(match['Winner Old Rating']);
        const winnerNewRating = parseFloat(match['Winner New Rating']);
        const winnerChange = parseFloat(match['Winner Change']);

        const loserOldRating = parseFloat(match['Loser Old Rating']);
        const loserNewRating = parseFloat(match['Loser New Rating']);
        const loserChange = parseFloat(match['Loser Change']);

        // Format date
        const date = new Date(match.Date);
        const formattedDate = date.toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        // Create ELO change cells
        const f1Cell = document.createElement('td');
        const f2Cell = document.createElement('td');

        if (f1IsWinner) {
            // Fencer1 won - get their rating data
            const f1ChangeClass = winnerChange >= 0 ? 'positive' : 'negative';
            const f1ChangeSign = winnerChange >= 0 ? '+' : '';
            const f2ChangeClass = loserChange >= 0 ? 'positive' : 'negative';
            const f2ChangeSign = loserChange >= 0 ? '+' : '';

            f1Cell.className = 'winner-elo';
            f2Cell.className = 'loser-elo';
            f1Cell.innerHTML = `<strong>${fencer1}</strong><br>${winnerOldRating.toFixed(1)} → ${winnerNewRating.toFixed(1)} <span class="${f1ChangeClass}">(${f1ChangeSign}${winnerChange.toFixed(1)})</span>`;
            f2Cell.innerHTML = `${fencer2}<br>${loserOldRating.toFixed(1)} → ${loserNewRating.toFixed(1)} <span class="${f2ChangeClass}">(${f2ChangeSign}${loserChange.toFixed(1)})</span>`;
        } else {
            // Fencer2 won - get their rating data
            const f1ChangeClass = loserChange >= 0 ? 'positive' : 'negative';
            const f1ChangeSign = loserChange >= 0 ? '+' : '';
            const f2ChangeClass = winnerChange >= 0 ? 'positive' : 'negative';
            const f2ChangeSign = winnerChange >= 0 ? '+' : '';

            f1Cell.className = 'loser-elo';
            f2Cell.className = 'winner-elo';
            f1Cell.innerHTML = `${fencer1}<br>${loserOldRating.toFixed(1)} → ${loserNewRating.toFixed(1)} <span class="${f1ChangeClass}">(${f1ChangeSign}${loserChange.toFixed(1)})</span>`;
            f2Cell.innerHTML = `<strong>${fencer2}</strong><br>${winnerOldRating.toFixed(1)} → ${winnerNewRating.toFixed(1)} <span class="${f2ChangeClass}">(${f2ChangeSign}${winnerChange.toFixed(1)})</span>`;
        }

        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${match['Match Type']}</td>
            <td>${match.Result}</td>
        `;
        row.appendChild(f1Cell);
        row.appendChild(f2Cell);

        tbody.appendChild(row);
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadData().then(() => {
        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const f1 = urlParams.get('f1');
        const f2 = urlParams.get('f2');

        if (f1 && f2) {
            document.getElementById('fencer1-select').value = f1;
            document.getElementById('fencer2-select').value = f2;
            analyzeMatchup();
        }
    });

    document.getElementById('analyze-btn').addEventListener('click', analyzeMatchup);
});
