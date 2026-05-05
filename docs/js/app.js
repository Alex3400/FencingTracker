// Load and display ELO ratings
let ratingsData = [];
let sessionsData = [];
let dataTable = null;

async function loadRatings() {
    try {
        const [ratingsResponse, sessionsResponse] = await Promise.all([
            fetch('data/elo_ratings.json'),
            fetch('data/sessions.json')
        ]);

        ratingsData = await ratingsResponse.json();
        sessionsData = await sessionsResponse.json();

        displayRatings(ratingsData);
        displayLatestSession();
        updateLastUpdate();
    } catch (error) {
        console.error('Error loading ratings:', error);
        document.getElementById('ratings-body').innerHTML =
            '<tr><td colspan="4" style="text-align: center; color: red;">Error loading data. Please try again later.</td></tr>';
    }
}

function displayRatings(data) {
    const tbody = document.getElementById('ratings-body');
    tbody.innerHTML = '';

    data.forEach((fencer, index) => {
        const row = document.createElement('tr');
        const rank = index + 1;

        // Add special styling for top 3
        let rankClass = '';
        if (rank === 1) rankClass = 'rank-1';
        else if (rank === 2) rankClass = 'rank-2';
        else if (rank === 3) rankClass = 'rank-3';

        row.innerHTML = `
            <td class="${rankClass}">${rank}</td>
            <td><a href="fencer.html?fencer=${encodeURIComponent(fencer.fencer)}" class="fencer-link">${fencer.fencer}</a></td>
            <td><strong>${fencer.rating}</strong></td>
            <td>${fencer.matches}</td>
        `;
        tbody.appendChild(row);
    });

    // Initialize or update DataTable
    if (dataTable) {
        dataTable.destroy();
    }

    dataTable = $('#ratings-table').DataTable({
        paging: true,
        searching: true,
        ordering: true,
        pageLength: 25,
        order: [[2, 'desc']], // Sort by rating column (descending)
        columnDefs: [
            { orderable: false, targets: 0 } // Don't allow sorting by rank
        ]
    });
}

// Filter function removed - status system no longer used

function displayLatestSession() {
    if (!sessionsData || sessionsData.length === 0) {
        document.getElementById('latest-session-link').textContent = 'No sessions found';
        return;
    }

    // Get the most recent session (last one in the array, since they're sorted oldest to newest)
    const latestSession = sessionsData[sessionsData.length - 1];

    const date = new Date(latestSession.date);
    const formattedDate = date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Create clickable link that will open sessions page and show details for this date
    const link = document.createElement('a');
    link.href = `sessions.html?date=${encodeURIComponent(latestSession.date)}`;
    link.className = 'date-link';
    link.textContent = formattedDate;

    document.getElementById('latest-session-link').innerHTML = '';
    document.getElementById('latest-session-link').appendChild(link);
}

function updateLastUpdate() {
    // Get current date
    const now = new Date();
    const formatted = now.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('last-update').textContent = formatted;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadRatings();
});
