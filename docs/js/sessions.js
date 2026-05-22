// Tournament sessions history
let sessionsData = [];
let matchHistoryData = [];
let dataTable = null;

async function loadSessions() {
    try {
        const [sessionsResponse, matchHistoryResponse] = await Promise.all([
            fetch('data/sessions.json'),
            fetch('data/elo_history.csv')
        ]);

        sessionsData = await sessionsResponse.json();

        // Parse match history CSV
        const matchHistoryText = await matchHistoryResponse.text();
        matchHistoryData = parseMatchHistoryCSV(matchHistoryText);

        displaySessions(sessionsData);
    } catch (error) {
        console.error('Error loading sessions:', error);
        document.getElementById('sessions-body').innerHTML =
            '<tr><td colspan="5" style="text-align: center; color: red;">Error loading data. Please try again later.</td></tr>';
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
            'Loser Change': values[10],
            'Expected': values[11]
        };
    });
}

function displaySessions(data) {
    const tbody = document.getElementById('sessions-body');
    tbody.innerHTML = '';

    data.forEach((session, index) => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => showSessionDetail(session));

        const date = new Date(session.date);
        const formattedDate = date.toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        let pouleClimber = '-';
        if (session.top_poule_climber && session.top_poule_climber !== 'None' && session.top_poule_gain > 0) {
            pouleClimber = `${session.top_poule_climber} (+${session.top_poule_gain})`;
        }

        const td = document.createElement('td');
        td.setAttribute('data-order', session.date);
        td.innerHTML = `<a href="#" class="date-link">${formattedDate}</a>`;
        td.querySelector('a').addEventListener('click', (e) => {
            e.preventDefault();
            showSessionDetail(session);
        });

        row.appendChild(td);
        row.innerHTML += `
            <td><strong>${session.winner}</strong></td>
            <td>${pouleClimber}</td>
            <td>${session.fencers_in_poules}</td>
            <td>${session.total_matches}</td>
        `;
        tbody.appendChild(row);
    });

    if (dataTable) {
        dataTable.destroy();
    }

    dataTable = $('#sessions-table').DataTable({
        paging: true,
        searching: true,
        ordering: true,
        pageLength: 25,
        order: [[0, 'desc']]
    });
}

function showSessionDetail(session) {
    document.querySelector('.sessions-list').style.display = 'none';
    document.getElementById('session-detail').style.display = 'block';

    // Update URL with the session date
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('date', session.date);
    window.history.pushState({ sessionDate: session.date }, '', newUrl);

    const date = new Date(session.date);
    const formattedDate = date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    document.getElementById('detail-title').textContent = `Tournament - ${formattedDate}`;
    document.getElementById('detail-winner').textContent = session.winner;
    document.getElementById('detail-participants').textContent = session.fencers_in_poules;
    document.getElementById('detail-matches').textContent = session.total_matches;

    let climberText = '-';
    if (session.top_poule_climber && session.top_poule_climber !== 'None') {
        climberText = `${session.top_poule_climber} (+${session.top_poule_gain})`;
    }
    document.getElementById('detail-climber').textContent = climberText;

    // Score distribution
    const scoreHTML = `
        <div class="score-grid">
            <div class="score-item"><strong>5-0:</strong> ${session.score_5_0}</div>
            <div class="score-item"><strong>5-1:</strong> ${session.score_5_1}</div>
            <div class="score-item"><strong>5-2:</strong> ${session.score_5_2}</div>
            <div class="score-item"><strong>5-3:</strong> ${session.score_5_3}</div>
            <div class="score-item"><strong>5-4:</strong> ${session.score_5_4}</div>
        </div>
        <p><strong>Total Touches:</strong> ${session.total_touches} (Avg: ${session.avg_touches_per_match.toFixed(2)} per match)</p>
        <p><strong>Poule Matches:</strong> ${session.poule_matches} | <strong>DE Matches:</strong> ${session.de_matches}</p>
    `;
    document.getElementById('score-distribution').innerHTML = scoreHTML;

    // Final results
    let resultsHTML = '<ol class="results-list">';
    session.final_results.forEach(result => {
        resultsHTML += `<li><a href="fencer.html?fencer=${encodeURIComponent(result.fencer)}&date=${encodeURIComponent(session.date)}" class="fencer-link">${result.fencer}</a></li>`;
    });
    resultsHTML += '</ol>';
    document.getElementById('final-results').innerHTML = resultsHTML;

    // Google sheet link
    const linkEl = document.getElementById('google-sheet-link');
    if (session.google_sheet_link) {
        linkEl.href = session.google_sheet_link;
        linkEl.style.display = 'inline-block';
    } else {
        linkEl.style.display = 'none';
    }

    // Display all matches
    displayAllMatches(session.date);

    window.scrollTo(0, 0);
}

function displayAllMatches(date) {
    const matchesDiv = document.getElementById('all-matches');

    // Filter matches for this date
    const dayMatches = matchHistoryData.filter(match => match['Date'] === date);

    if (dayMatches.length === 0) {
        matchesDiv.innerHTML = '<p>No matches found for this tournament.</p>';
        return;
    }

    // Separate poule and DE matches
    const pouleMatches = dayMatches.filter(match => match['Match Type'] === 'Poule');
    const deMatches = dayMatches.filter(match => match['Match Type'] !== 'Poule');

    // Group DE matches by bracket
    const deByBracket = {};
    deMatches.forEach(match => {
        const bracket = match['Match Type'];
        if (!deByBracket[bracket]) {
            deByBracket[bracket] = [];
        }
        deByBracket[bracket].push(match);
    });

    // Get all bracket names and sort them chronologically
    const bracketOrder = Object.keys(deByBracket).sort((a, b) => {
        const getUpperBound = (bracket) => {
            const match = bracket.match(/L\d+-(\d+)/);
            return match ? parseInt(match[1]) : 0;
        };

        const aUpper = getUpperBound(a);
        const bUpper = getUpperBound(b);

        if (aUpper !== bUpper) {
            return bUpper - aUpper;
        }

        const getLowerBound = (bracket) => {
            const match = bracket.match(/L(\d+)-\d+/);
            return match ? parseInt(match[1]) : 0;
        };

        return getLowerBound(a) - getLowerBound(b);
    });

    // Build all matches array with proper ordering
    const allMatches = [];

    // Add poule matches first
    pouleMatches.forEach(match => {
        allMatches.push({
            type: 'Poule',
            match: match
        });
    });

    // Add DE matches in bracket order
    bracketOrder.forEach(bracket => {
        if (deByBracket[bracket]) {
            deByBracket[bracket].forEach(match => {
                allMatches.push({
                    type: bracket,
                    match: match
                });
            });
        }
    });

    // Create single table with all matches (similar to head-to-head style)
    let html = '<div class="match-history-table-wrapper">';
    html += '<table id="session-matches-table" class="matches-table" style="width: 100%;">';
    html += '<thead><tr>';
    html += '<th>Type</th>';
    html += '<th>Result</th>';
    html += '<th colspan="2">Elo Changes</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    allMatches.forEach(({ type, match }) => {
        const winnerChange = parseFloat(match['Winner Change']);
        const loserChange = parseFloat(match['Loser Change']);
        const winnerChangeClass = winnerChange >= 0 ? 'positive' : 'negative';
        const loserChangeClass = loserChange >= 0 ? 'positive' : 'negative';
        const winnerSign = winnerChange >= 0 ? '+' : '';
        const loserSign = loserChange >= 0 ? '+' : '';

        const winnerOld = parseFloat(match['Winner Old Rating']);
        const winnerNew = parseFloat(match['Winner New Rating']);
        const loserOld = parseFloat(match['Loser Old Rating']);
        const loserNew = parseFloat(match['Loser New Rating']);

        // Check if this is a walkover (both changes are 0.0 and it's a DE match)
        const isWalkover = winnerChange === 0.0 && loserChange === 0.0 && type !== 'Poule';

        // Format type display
        const typeDisplay = type === 'Poule' ? 'Poule' : type;

        html += `<tr${isWalkover ? ' class="walkover-row"' : ''}>`;
        html += `<td>${typeDisplay}</td>`;
        html += `<td>${match['Result']}${isWalkover ? ' <span class="walkover-badge">Walkover</span>' : ''}</td>`;

        // Winner Elo cell
        html += `<td class="winner-elo${isWalkover ? ' walkover-elo' : ''}">`;
        html += `<strong><a href="fencer.html?fencer=${encodeURIComponent(match['Winner'])}" class="fencer-link">${match['Winner']}</a></strong><br>`;
        html += `${winnerOld.toFixed(1)} → ${winnerNew.toFixed(1)} `;
        html += `<span class="${winnerChangeClass}">(${winnerSign}${winnerChange.toFixed(1)})</span>`;
        html += `</td>`;

        // Loser Elo cell
        html += `<td class="loser-elo${isWalkover ? ' walkover-elo' : ''}">`;
        html += `<a href="fencer.html?fencer=${encodeURIComponent(match['Loser'])}" class="fencer-link">${match['Loser']}</a><br>`;
        html += `${loserOld.toFixed(1)} → ${loserNew.toFixed(1)} `;
        html += `<span class="${loserChangeClass}">(${loserSign}${loserChange.toFixed(1)})</span>`;
        html += `</td>`;

        html += `</tr>`;
    });

    html += '</tbody></table></div>';

    matchesDiv.innerHTML = html;
}

function getBracketDisplayName(bracket) {
    const names = {
        'L1-2': 'Final',
        'L1-4': 'Semifinals',
        'L3-4': 'Bronze Medal Match (3rd Place)',
        'L1-8': 'Quarterfinals',
        'L5-8': '5th-8th Place',
        'L1-16': 'Round of 16',
        'L9-16': '9th-16th Place',
        'L9-12': '9th-12th Place',
        'L13-16': '13th-16th Place',
        'L17-32': '17th-32nd Place',
        'L17-24': '17th-24th Place',
        'L25-32': '25th-32nd Place',
        'L1-32': 'Round of 32'
    };
    return names[bracket] || bracket;
}

function closeDetail() {
    document.querySelector('.sessions-list').style.display = 'block';
    document.getElementById('session-detail').style.display = 'none';

    // Remove date parameter from URL
    const newUrl = new URL(window.location);
    newUrl.searchParams.delete('date');
    window.history.pushState({}, '', newUrl);
}

document.addEventListener('DOMContentLoaded', () => {
    loadSessions().then(() => {
        // Check for date parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const dateParam = urlParams.get('date');

        if (dateParam && sessionsData.length > 0) {
            // Find the session with this date
            const session = sessionsData.find(s => s.date === dateParam);
            if (session) {
                showSessionDetail(session);
            }
        }
    });

    document.getElementById('close-detail-btn').addEventListener('click', closeDetail);

    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
        const urlParams = new URLSearchParams(window.location.search);
        const dateParam = urlParams.get('date');

        if (dateParam && sessionsData.length > 0) {
            const session = sessionsData.find(s => s.date === dateParam);
            if (session) {
                showSessionDetail(session);
            }
        } else {
            closeDetail();
        }
    });
});
