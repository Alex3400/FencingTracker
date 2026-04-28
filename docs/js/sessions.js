// Tournament sessions history
let sessionsData = [];
let dataTable = null;

async function loadSessions() {
    try {
        const response = await fetch('data/sessions.json');
        sessionsData = await response.json();
        displaySessions(sessionsData);
    } catch (error) {
        console.error('Error loading sessions:', error);
        document.getElementById('sessions-body').innerHTML =
            '<tr><td colspan="5" style="text-align: center; color: red;">Error loading data. Please try again later.</td></tr>';
    }
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

    window.scrollTo(0, 0);
}

function closeDetail() {
    document.querySelector('.sessions-list').style.display = 'block';
    document.getElementById('session-detail').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    loadSessions();
    document.getElementById('close-detail-btn').addEventListener('click', closeDetail);
});
