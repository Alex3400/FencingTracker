// Load and display Elo ratings
let ratingsData = [];
let sessionsData = [];
let dataTable = null;
let currentActivityFilter = 'active'; // Default filter
let filterListenerAttached = false; // Flag to prevent duplicate listeners

async function loadRatings() {
    try {
        const [ratingsResponse, sessionsResponse] = await Promise.all([
            fetch('data/elo_ratings.json'),
            fetch('data/sessions.json')
        ]);

        ratingsData = await ratingsResponse.json();
        sessionsData = await sessionsResponse.json();

        // Load saved filter preference from localStorage
        const savedFilter = localStorage.getItem('activityFilter');
        if (savedFilter) {
            currentActivityFilter = savedFilter;
            const filterSelect = document.getElementById('activity-filter');
            if (filterSelect) {
                filterSelect.value = savedFilter;
            }
        }

        applyActivityFilter();
        displayLatestSession();
        updateLastUpdate();

        // Attach event listener after data is loaded (only once)
        if (!filterListenerAttached) {
            const activityFilter = document.getElementById('activity-filter');
            if (activityFilter) {
                activityFilter.addEventListener('change', (e) => {
                    currentActivityFilter = e.target.value;
                    // Save preference to localStorage
                    localStorage.setItem('activityFilter', currentActivityFilter);
                    applyActivityFilter();
                });
                filterListenerAttached = true;
            }
        }
    } catch (error) {
        console.error('Error loading ratings:', error);
        document.getElementById('ratings-body').innerHTML =
            '<tr><td colspan="5" style="text-align: center; color: red;">Error loading data. Please try again later.</td></tr>';
    }
}

function applyActivityFilter() {
    const filterValue = currentActivityFilter;
    let filteredData = ratingsData;

    if (filterValue === 'active') {
        // Show only Active fencers
        filteredData = ratingsData.filter(f => f.active_status === 'Active');
    } else if (filterValue === 'semi-active') {
        // Show Active and Semi-active fencers
        filteredData = ratingsData.filter(f =>
            f.active_status === 'Active' || f.active_status === 'Semi-active'
        );
    }
    // 'all' shows everyone

    displayRatings(filteredData);
}

function displayRatings(data) {
    // Destroy existing DataTable first
    if (dataTable) {
        dataTable.destroy();
        dataTable = null;
    }

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

        // Status badge styling
        let statusBadge = '';
        if (fencer.active_status) {
            let statusClass = 'status-inactive';
            if (fencer.active_status === 'Active') {
                statusClass = 'status-active';
            } else if (fencer.active_status === 'Semi-active') {
                statusClass = 'status-semi-active';
            }
            statusBadge = `<span class="status-badge ${statusClass}">${fencer.active_status}</span>`;
        } else {
            statusBadge = '<span style="color: #999;">N/A</span>';
        }

        row.innerHTML = `
            <td class="${rankClass}">${rank}</td>
            <td><a href="fencer.html?fencer=${encodeURIComponent(fencer.fencer)}" class="fencer-link">${fencer.fencer}</a></td>
            <td>${statusBadge}</td>
            <td><strong>${fencer.rating}</strong></td>
            <td>${fencer.matches}</td>
        `;
        tbody.appendChild(row);
    });

    // Initialize DataTable
    dataTable = $('#ratings-table').DataTable({
        paging: true,
        searching: true,
        ordering: true,
        pageLength: 25,
        order: [[3, 'desc']], // Sort by rating column (descending)
        columnDefs: [
            { orderable: false, targets: 0 } // Don't allow sorting by rank
        ]
    });
}

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
