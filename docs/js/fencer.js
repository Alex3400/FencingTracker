// Individual fencer statistics page
let ratingsData = [];
let timelineData = [];
let h2hData = [];
let fencerStatsData = [];
let matchHistoryData = [];
let sessionsData = [];
let chart = null;
let placementTable = null;

const COLORS = {
    primary: '#2c5aa0',
    success: '#27ae60',
    danger: '#e74c3c'
};

async function loadData() {
    try {
        const [ratingsResponse, timelineResponse, h2hResponse, statsResponse, historyResponse, sessionsResponse] = await Promise.all([
            fetch('data/elo_ratings.json'),
            fetch('data/elo_timeline.json'),
            fetch('data/head_to_head.json'),
            fetch('data/fencer_stats.csv'),
            fetch('data/elo_history.csv'),
            fetch('data/sessions.json')
        ]);

        ratingsData = await ratingsResponse.json();
        timelineData = await timelineResponse.json();
        h2hData = await h2hResponse.json();
        sessionsData = await sessionsResponse.json();

        // Parse fencer stats CSV
        const statsText = await statsResponse.text();
        fencerStatsData = parseStatsCSV(statsText);

        // Parse match history CSV
        const historyText = await historyResponse.text();
        matchHistoryData = parseMatchHistoryCSV(historyText);

        populateFencerSelect();

        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const fencerParam = urlParams.get('fencer');
        const dateParam = urlParams.get('date');

        if (fencerParam) {
            document.getElementById('fencer-select').value = fencerParam;
            displayFencerStats(fencerParam, dateParam);
        }
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading fencer data. Please try again later.');
    }
}

function parseMatchHistoryCSV(text) {
    const lines = text.trim().split('\n');
    return lines.slice(1).map(line => {
        const values = line.split(',');
        return {
            'Date': values[0],
            'Match Type': values[1],
            'Result': values[2],
            'Winner': values[3],
            'Winner Old Rating': values[4],
            'Winner New Rating': values[5],
            'Winner Change': values[6],
            'Loser': values[7],
            'Loser Old Rating': values[8],
            'Loser New Rating': values[9],
            'Loser Change': values[10]
        };
    });
}

function parseStatsCSV(text) {
    const lines = text.trim().split('\n');
    const headers = parseCSVLine(lines[0]);

    return lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const row = {};
        headers.forEach((header, i) => {
            row[header] = values[i] || '';
        });
        return row;
    });
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

function populateFencerSelect() {
    const select = document.getElementById('fencer-select');

    // Sort by rating descending
    const sortedFencers = [...ratingsData].sort((a, b) => b.rating - a.rating);

    sortedFencers.forEach(fencer => {
        const option = document.createElement('option');
        option.value = fencer.fencer;
        option.textContent = `${fencer.fencer} (${fencer.rating})`;
        select.appendChild(option);
    });
}

function displayFencerStats(fencerName, autoSelectDate = null) {
    if (!fencerName) {
        hideAllSections();
        return;
    }

    // Find fencer data
    const ratingInfo = ratingsData.find(f => f.fencer === fencerName);
    const statsInfo = fencerStatsData.find(f => f.Fencer === fencerName);

    if (!ratingInfo) {
        alert('Fencer not found!');
        return;
    }

    // Show sections
    document.getElementById('fencer-stats').style.display = 'block';
    document.getElementById('placement-stats-section').style.display = 'block';
    document.getElementById('elo-chart-section').style.display = 'block';
    document.getElementById('day-matches-section').style.display = 'block';
    document.getElementById('h2h-section').style.display = 'block';

    // Update name
    document.getElementById('fencer-name').textContent = fencerName;

    // Current rating and status
    document.getElementById('current-rating').textContent = ratingInfo.rating;
    const statusBadge = ratingInfo.status === 'Established'
        ? '<span class="badge established">Established</span>'
        : '<span class="badge provisional">Provisional</span>';
    document.getElementById('rating-status').innerHTML = statusBadge;

    // Rank
    const rank = ratingsData.findIndex(f => f.fencer === fencerName) + 1;
    document.getElementById('rank').textContent = `#${rank}`;
    document.getElementById('total-fencers').textContent = ratingsData.length;

    // Matches and win rate
    document.getElementById('total-matches').textContent = ratingInfo.matches;
    if (statsInfo && statsInfo['Winrate']) {
        const winRate = parseFloat(statsInfo['Winrate']) * 100;
        document.getElementById('win-rate').textContent = winRate.toFixed(1);
    } else {
        document.getElementById('win-rate').textContent = '-';
    }

    // Max ELO
    if (statsInfo && statsInfo['Max ELO (All-Time)']) {
        const maxElo = parseFloat(statsInfo['Max ELO (All-Time)']);
        if (!isNaN(maxElo)) {
            document.getElementById('max-elo').textContent = maxElo.toFixed(1);
            document.getElementById('max-elo-note').textContent = 'Peak rating achieved';
        } else {
            document.getElementById('max-elo').textContent = '-';
            document.getElementById('max-elo-note').textContent = 'Need 25+ matches';
        }
    } else {
        document.getElementById('max-elo').textContent = '-';
        document.getElementById('max-elo-note').textContent = 'Need 25+ matches';
    }

    // Average Seeding
    if (statsInfo && statsInfo['Avg Seeding']) {
        const avgSeeding = parseFloat(statsInfo['Avg Seeding']);
        if (!isNaN(avgSeeding) && avgSeeding > 0) {
            document.getElementById('avg-seeding').textContent = avgSeeding.toFixed(1);
        } else {
            document.getElementById('avg-seeding').textContent = '-';
        }
    } else {
        document.getElementById('avg-seeding').textContent = '-';
    }

    // Average Placement
    if (statsInfo && statsInfo['Avg Placement']) {
        const avgPlacement = parseFloat(statsInfo['Avg Placement']);
        if (!isNaN(avgPlacement) && avgPlacement > 0) {
            document.getElementById('avg-placement').textContent = avgPlacement.toFixed(1);
        } else {
            document.getElementById('avg-placement').textContent = '-';
        }
    } else {
        document.getElementById('avg-placement').textContent = '-';
    }

    // Draw ELO chart
    drawFencerChart(fencerName);

    // Display placement stats
    displayPlacementStats(fencerName, statsInfo);

    // Setup tournament date selector
    populateDaySelector(fencerName);

    // Setup head-to-head
    setupHeadToHead(fencerName);

    // Auto-select date if provided in URL
    if (autoSelectDate) {
        document.getElementById('day-select').value = autoSelectDate;
        showDayMatches(fencerName, autoSelectDate);
        // Scroll to the day matches section after a brief delay to ensure rendering
        setTimeout(() => {
            document.getElementById('day-matches-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
}

function displayPlacementStats(fencerName, statsInfo) {
    const summaryDiv = document.getElementById('placement-summary');
    summaryDiv.innerHTML = '';

    // Placement categories - ALWAYS SHOW ALL 6
    const placements = [
        { name: '1st Place', key: 'Win', color: '#FFD700', icon: '🥇', bracket: '1st' },
        { name: '2nd Place', key: 'L2', color: '#B8B8D0', icon: '🥈', bracket: '2nd' },
        { name: '3rd-4th', key: 'L4', color: '#CD7F32', icon: '🥉', bracket: '3rd-4th' },
        { name: '5th-8th', key: 'L8', color: '#4a90e2', icon: '🏅', bracket: '5th-8th' },
        { name: '9th-16th', key: 'L16', color: '#95a5a6', icon: '📍', bracket: '9th-16th' },
        { name: '17th-32nd', key: 'L32', color: '#bdc3c7', icon: '📍', bracket: '17th-32nd' }
    ];

    // Summary cards
    const placementGrid = document.createElement('div');
    placementGrid.className = 'placement-grid';

    placements.forEach(placement => {
        const value = statsInfo ? statsInfo[placement.key] : '';
        let count = 0;

        if (value && value !== '') {
            const match = value.toString().match(/^(\d+)/);
            if (match) {
                count = parseInt(match[1]);
            }
        }

        const card = document.createElement('div');
        card.className = 'placement-card';
        card.style.borderLeft = `4px solid ${placement.color}`;

        card.innerHTML = `
            <div class="placement-icon">${placement.icon}</div>
            <div class="placement-name">${placement.name}</div>
            <div class="placement-count">${count}</div>
        `;

        placementGrid.appendChild(card);
    });

    summaryDiv.appendChild(placementGrid);

    // Destroy existing DataTable first
    if (placementTable) {
        placementTable.destroy();
        placementTable = null;
    }

    // Build detailed table
    const tbody = document.getElementById('placement-table-body');
    tbody.innerHTML = '';

    // Get all dates where this fencer participated (from matches)
    const participationDates = new Set();
    matchHistoryData.forEach(match => {
        if (match['Winner'] === fencerName || match['Loser'] === fencerName) {
            participationDates.add(match['Date']);
        }
    });

    // Build placement data for each date
    const fencerPlacements = [];
    participationDates.forEach(date => {
        // Check if they have a placement for this date
        const session = sessionsData.find(s => s.date === date);
        let placementData = null;

        if (session && session.final_results) {
            const result = session.final_results.find(r => r.fencer === fencerName);
            if (result) {
                const place = result.place;
                const fieldSize = session.final_results.length;
                let bracket = '';
                let color = '';

                if (place === 1) {
                    bracket = '1st';
                    color = '#FFD700';
                } else if (place === 2) {
                    bracket = '2nd';
                    color = '#B8B8D0';
                } else if (place <= 4) {
                    bracket = '3rd-4th';
                    color = '#CD7F32';
                } else if (place <= 8) {
                    bracket = '5th-8th';
                    color = '#4a90e2';
                } else if (place <= 16) {
                    bracket = '9th-16th';
                    color = '#95a5a6';
                } else if (place <= 32) {
                    bracket = '17th-32nd';
                    color = '#bdc3c7';
                } else {
                    bracket = `${place}th`;
                    color = '#ecf0f1';
                }

                placementData = {
                    date: date,
                    place: place,
                    fieldSize: fieldSize,
                    bracket: bracket,
                    color: color,
                    hasPlacement: true
                };
            }
        }

        // If no placement found, they participated in poules only
        if (!placementData) {
            placementData = {
                date: date,
                place: null,
                fieldSize: null,
                bracket: '-',
                color: '#f8f9fa',
                hasPlacement: false
            };
        }

        fencerPlacements.push(placementData);
    });

    // Populate table
    fencerPlacements.forEach(placement => {
        const row = document.createElement('tr');
        row.style.backgroundColor = placement.color + '22'; // Add transparency

        const date = new Date(placement.date);
        const formattedDate = date.toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const dateCell = document.createElement('td');
        dateCell.setAttribute('data-order', placement.date);
        const dateLink = document.createElement('a');
        dateLink.href = '#';
        dateLink.className = 'date-link';
        dateLink.textContent = formattedDate;
        dateLink.addEventListener('click', (e) => {
            e.preventDefault();
            // Set the day selector to this date and show matches
            document.getElementById('day-select').value = placement.date;
            showDayMatches(fencerName, placement.date);
            // Scroll to the day matches section
            document.getElementById('day-matches-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        dateCell.appendChild(dateLink);

        const placeCell = document.createElement('td');
        if (placement.hasPlacement) {
            placeCell.textContent = `${placement.place}/${placement.fieldSize}`;
            placeCell.setAttribute('data-order', placement.place);
        } else {
            placeCell.textContent = '-';
            placeCell.setAttribute('data-order', 999); // Sort to bottom
        }

        const bracketCell = document.createElement('td');
        bracketCell.textContent = placement.bracket;
        if (placement.hasPlacement) {
            bracketCell.style.fontWeight = '600';
        }

        row.appendChild(dateCell);
        row.appendChild(placeCell);
        row.appendChild(bracketCell);

        tbody.appendChild(row);
    });

    // Initialize DataTable
    placementTable = $('#placement-table').DataTable({
        paging: true,
        searching: false,
        ordering: true,
        pageLength: 10,
        order: [[0, 'desc']], // Default: newest first
        columnDefs: [
            { orderable: false, targets: 2 } // Disable sorting on Bracket column (index 2)
        ],
        language: {
            emptyTable: "No tournament placements found"
        }
    });
}

function displayDetailedStats(statsInfo) {
    if (!statsInfo) {
        return;
    }

    // Overall Performance
    document.getElementById('total-appearances').textContent = statsInfo['Total Appearances'] || '-';
    document.getElementById('total-wins').textContent = statsInfo['Wins'] || '-';
    document.getElementById('total-losses').textContent = statsInfo['Losses'] || '-';

    const avgSeeding = statsInfo['Avg Seeding'];
    document.getElementById('avg-seeding').textContent = avgSeeding && avgSeeding !== '' ? parseFloat(avgSeeding).toFixed(1) : '-';

    const avgPlacement = statsInfo['Avg Placement'];
    document.getElementById('avg-placement').textContent = avgPlacement && avgPlacement !== '' && avgPlacement !== '0.0' ? parseFloat(avgPlacement).toFixed(1) : '-';

    // Poule Statistics
    document.getElementById('poule-matches').textContent = statsInfo['Poule Matches'] || '-';
    document.getElementById('poule-wins').textContent = statsInfo['Poule Wins'] || '-';
    document.getElementById('poule-losses').textContent = statsInfo['Poule Losses'] || '-';

    const pouleWinrate = statsInfo['Poule Winrate'];
    document.getElementById('poule-winrate').textContent = pouleWinrate && pouleWinrate !== '' ? (parseFloat(pouleWinrate) * 100).toFixed(1) + '%' : '-';

    // DE Statistics
    document.getElementById('de-appearances').textContent = statsInfo['DE Appearances'] || '-';
    document.getElementById('de-matches').textContent = statsInfo['DE Matches'] || '-';
    document.getElementById('de-wins').textContent = statsInfo['DE Wins'] || '-';
    document.getElementById('de-losses').textContent = statsInfo['DE Losses'] || '-';

    const deWinrate = statsInfo['DE Winrate'];
    document.getElementById('de-winrate').textContent = deWinrate && deWinrate !== '' ? (parseFloat(deWinrate) * 100).toFixed(1) + '%' : '-';

    // Touch Statistics
    document.getElementById('touches-scored').textContent = statsInfo['Touches Scored'] || '-';
    document.getElementById('touches-received').textContent = statsInfo['Touches Received'] || '-';

    const touchDiff = statsInfo['Touch Differential'];
    if (touchDiff && touchDiff !== '') {
        const diff = parseInt(touchDiff);
        const sign = diff >= 0 ? '+' : '';
        document.getElementById('touch-differential').textContent = sign + diff;
    } else {
        document.getElementById('touch-differential').textContent = '-';
    }
}

function drawFencerChart(fencerName) {
    const ctx = document.getElementById('fencer-elo-chart').getContext('2d');

    // Extract this fencer's timeline with ranks
    const labels = [];
    const data = [];
    const ranks = []; // Store rank at each point

    timelineData.forEach(snapshot => {
        if (snapshot.ratings[fencerName]) {
            labels.push(`${snapshot.date} ${snapshot.phase}`);
            data.push(snapshot.ratings[fencerName]);

            // Calculate rank at this snapshot
            const sortedRatings = Object.entries(snapshot.ratings)
                .sort((a, b) => b[1] - a[1]);
            const rank = sortedRatings.findIndex(([name, _]) => name === fencerName) + 1;
            ranks.push(rank);
        }
    });

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: fencerName,
                data: data,
                borderColor: COLORS.primary,
                backgroundColor: COLORS.primary + '33',
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5,
                tension: 0.1,
                ranks: ranks // Store ranks for tooltip
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const rating = context.parsed.y.toFixed(1);
                            const rank = context.dataset.ranks[context.dataIndex];
                            return `Rating: ${rating} (Rank #${rank})`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Tournament Sessions'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'ELO Rating'
                    },
                    beginAtZero: false
                }
            }
        }
    });
}

function populateDaySelector(fencerName) {
    const select = document.getElementById('day-select');
    select.innerHTML = '<option value="">-- Select a date --</option>';

    // Get all dates where this fencer participated
    const dates = new Set();
    matchHistoryData.forEach(match => {
        if (match['Winner'] === fencerName || match['Loser'] === fencerName) {
            dates.add(match['Date']);
        }
    });

    // Sort dates descending (most recent first)
    const sortedDates = Array.from(dates).sort((a, b) => new Date(b) - new Date(a));

    sortedDates.forEach(date => {
        const formattedDate = new Date(date).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        const option = document.createElement('option');
        option.value = date;
        option.textContent = formattedDate;
        select.appendChild(option);
    });

    // Clear results
    document.getElementById('day-matches-results').style.display = 'none';
}

function showDayMatches(fencerName, date) {
    if (!date) {
        document.getElementById('day-matches-results').style.display = 'none';
        return;
    }

    // Filter matches for this fencer on this date
    const matches = matchHistoryData.filter(match =>
        match['Date'] === date &&
        (match['Winner'] === fencerName || match['Loser'] === fencerName)
    );

    if (matches.length === 0) {
        document.getElementById('day-matches-results').style.display = 'none';
        return;
    }

    // Show results section
    document.getElementById('day-matches-results').style.display = 'block';

    // Set title
    const formattedDate = new Date(date).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('day-matches-title').textContent = `Matches on ${formattedDate}`;

    // Populate table
    const tbody = document.getElementById('day-matches-body');
    tbody.innerHTML = '';

    matches.forEach(match => {
        const row = document.createElement('tr');

        const isWinner = match['Winner'] === fencerName;
        const opponent = isWinner ? match['Loser'] : match['Winner'];

        const fencerOldRating = isWinner ? parseFloat(match['Winner Old Rating']) : parseFloat(match['Loser Old Rating']);
        const fencerNewRating = isWinner ? parseFloat(match['Winner New Rating']) : parseFloat(match['Loser New Rating']);
        const fencerChange = isWinner ? parseFloat(match['Winner Change']) : parseFloat(match['Loser Change']);

        const opponentOldRating = isWinner ? parseFloat(match['Loser Old Rating']) : parseFloat(match['Winner Old Rating']);
        const opponentNewRating = isWinner ? parseFloat(match['Loser New Rating']) : parseFloat(match['Winner New Rating']);
        const opponentChange = isWinner ? parseFloat(match['Loser Change']) : parseFloat(match['Winner Change']);

        // Remove (W) or (L) prefix since we're already showing Won/Lost
        const cleanResult = match['Result'].replace(/^\(W\)\s*|\(L\)\s*/g, '');
        const resultText = isWinner ? `Won, ${cleanResult}` : `Lost, ${cleanResult}`;
        const resultClass = isWinner ? 'winner-elo' : 'loser-elo';

        const fencerEloCell = document.createElement('td');
        fencerEloCell.className = resultClass;
        const changeClass = fencerChange >= 0 ? 'positive' : 'negative';
        const changeSign = fencerChange >= 0 ? '+' : '';
        fencerEloCell.innerHTML = `${fencerOldRating.toFixed(1)} → ${fencerNewRating.toFixed(1)} <span class="${changeClass}">(${changeSign}${fencerChange.toFixed(1)})</span>`;

        const opponentEloCell = document.createElement('td');
        const oppChangeClass = opponentChange >= 0 ? 'positive' : 'negative';
        const oppChangeSign = opponentChange >= 0 ? '+' : '';
        opponentEloCell.innerHTML = `${opponentOldRating.toFixed(1)} → ${opponentNewRating.toFixed(1)} <span class="${oppChangeClass}">(${oppChangeSign}${opponentChange.toFixed(1)})</span>`;

        row.innerHTML = `
            <td><a href="fencer.html?fencer=${encodeURIComponent(opponent)}" class="fencer-link">${opponent}</a></td>
            <td>${match['Match Type']}</td>
            <td>${resultText}</td>
        `;
        row.appendChild(fencerEloCell);
        row.appendChild(opponentEloCell);

        tbody.appendChild(row);
    });
}

function setupHeadToHead(fencerName) {
    const select = document.getElementById('h2h-opponent-select');
    select.innerHTML = '<option value="">-- Select opponent --</option>';

    // Get all opponents this fencer has faced
    const opponents = new Set();
    h2hData.forEach(matchup => {
        if (matchup.fencer1 === fencerName) {
            opponents.add(matchup.fencer2);
        } else if (matchup.fencer2 === fencerName) {
            opponents.add(matchup.fencer1);
        }
    });

    // Sort alphabetically
    const sortedOpponents = Array.from(opponents).sort();

    sortedOpponents.forEach(opponent => {
        const option = document.createElement('option');
        option.value = opponent;
        option.textContent = opponent;
        select.appendChild(option);
    });

    // Clear results
    document.getElementById('h2h-results').style.display = 'none';
    document.getElementById('h2h-no-matches').style.display = 'none';
}

function showHeadToHead(fencer1, fencer2) {
    // Find matchup data
    const matchup = h2hData.find(m =>
        (m.fencer1 === fencer1 && m.fencer2 === fencer2) ||
        (m.fencer1 === fencer2 && m.fencer2 === fencer1)
    );

    if (!matchup) {
        document.getElementById('h2h-results').style.display = 'none';
        document.getElementById('h2h-no-matches').style.display = 'block';
        return;
    }

    document.getElementById('h2h-no-matches').style.display = 'none';
    document.getElementById('h2h-results').style.display = 'block';

    // Determine which is fencer1
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

    // Calculate expected outcome
    const f1Expected = 1 / (1 + Math.pow(10, (f2Rating.rating - f1Rating.rating) / 400));
    const f2Expected = 1 - f1Expected;

    const totalMatches = matchup.total_matches;
    const pouleMatches = matchup.poule_matches;
    const deMatches = matchup.de_matches;

    // Display overall stats
    document.getElementById('h2h-overall-stats').innerHTML = `
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
    document.getElementById('h2h-rating-stats').innerHTML = `
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
    if (pouleMatches > 0) {
        document.getElementById('h2h-poule-stats').innerHTML = `
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
        document.getElementById('h2h-poule-stats').innerHTML = '<p class="no-data-text">No poule matches</p>';
    }

    // Display DE stats
    if (deMatches > 0) {
        document.getElementById('h2h-de-stats').innerHTML = `
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
        document.getElementById('h2h-de-stats').innerHTML = '<p class="no-data-text">No DE matches</p>';
    }

    // Display match history
    displayMatchHistory(f1Name, f2Name);
}

function displayMatchHistory(fencer1, fencer2) {
    const tbody = document.getElementById('h2h-match-history-body');
    tbody.innerHTML = '';

    // Filter matches
    const matches = matchHistoryData.filter(match =>
        (match['Winner'] === fencer1 && match['Loser'] === fencer2) ||
        (match['Winner'] === fencer2 && match['Loser'] === fencer1)
    );

    matches.forEach(match => {
        const row = document.createElement('tr');

        const f1IsWinner = match['Winner'] === fencer1;

        const winnerOldRating = parseFloat(match['Winner Old Rating']);
        const winnerNewRating = parseFloat(match['Winner New Rating']);
        const winnerChange = parseFloat(match['Winner Change']);

        const loserOldRating = parseFloat(match['Loser Old Rating']);
        const loserNewRating = parseFloat(match['Loser New Rating']);
        const loserChange = parseFloat(match['Loser Change']);

        const date = new Date(match['Date']);
        const formattedDate = date.toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        // Remove (W) or (L) prefix and add Won/Lost from fencer1's perspective
        const cleanResult = match['Result'].replace(/^\(W\)\s*|\(L\)\s*/g, '');
        const resultText = f1IsWinner ? `Won, ${cleanResult}` : `Lost, ${cleanResult}`;

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
            <td>${resultText}</td>
        `;
        row.appendChild(f1Cell);
        row.appendChild(f2Cell);

        tbody.appendChild(row);
    });
}

function hideAllSections() {
    document.getElementById('fencer-stats').style.display = 'none';
    document.getElementById('placement-stats-section').style.display = 'none';
    document.getElementById('elo-chart-section').style.display = 'none';
    document.getElementById('day-matches-section').style.display = 'none';
    document.getElementById('h2h-section').style.display = 'none';
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadData();

    document.getElementById('fencer-select').addEventListener('change', (e) => {
        const fencer = e.target.value;
        if (fencer) {
            // Update URL without reload
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('fencer', fencer);
            window.history.pushState({}, '', newUrl);

            displayFencerStats(fencer);
        } else {
            hideAllSections();
        }
    });

    document.getElementById('h2h-opponent-select').addEventListener('change', (e) => {
        const fencer1 = document.getElementById('fencer-select').value;
        const fencer2 = e.target.value;

        if (fencer1 && fencer2) {
            showHeadToHead(fencer1, fencer2);
        } else {
            document.getElementById('h2h-results').style.display = 'none';
            document.getElementById('h2h-no-matches').style.display = 'none';
        }
    });

    document.getElementById('day-select').addEventListener('change', (e) => {
        const fencerName = document.getElementById('fencer-select').value;
        const date = e.target.value;

        if (fencerName && date) {
            showDayMatches(fencerName, date);
        } else {
            document.getElementById('day-matches-results').style.display = 'none';
        }
    });
});
