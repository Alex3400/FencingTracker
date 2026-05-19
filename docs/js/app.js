// Load and display Elo ratings
let ratingsData = [];
let sessionsData = [];
let fencerStatsData = [];
let timelineData = [];
let dataTable = null;
let currentActivityFilter = 'active'; // Default filter
let filterListenerAttached = false; // Flag to prevent duplicate listeners
let currentSnapshot = null; // null means current/live data

async function loadRatings() {
    try {
        const [ratingsResponse, sessionsResponse, statsResponse, timelineResponse] = await Promise.all([
            fetch('data/elo_ratings.json'),
            fetch('data/sessions.json'),
            fetch('data/fencer_stats.csv'),
            fetch('data/elo_timeline.json')
        ]);

        ratingsData = await ratingsResponse.json();
        sessionsData = await sessionsResponse.json();
        timelineData = await timelineResponse.json();

        // Parse fencer stats CSV
        const statsText = await statsResponse.text();
        fencerStatsData = parseStatsCSV(statsText);

        // Load saved filter preference from localStorage
        const savedFilter = localStorage.getItem('activityFilter');
        if (savedFilter) {
            currentActivityFilter = savedFilter;
            const filterSelect = document.getElementById('activity-filter');
            if (filterSelect) {
                filterSelect.value = savedFilter;
            }
        }

        populateSnapshotSelector();
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
            }

            const snapshotFilter = document.getElementById('snapshot-filter');
            if (snapshotFilter) {
                snapshotFilter.addEventListener('change', (e) => {
                    const value = e.target.value;
                    currentSnapshot = value === 'current' ? null : parseInt(value);
                    applyActivityFilter();
                });
            }

            filterListenerAttached = true;
        }
    } catch (error) {
        console.error('Error loading ratings:', error);
        document.getElementById('ratings-body').innerHTML =
            '<tr><td colspan="6" style="text-align: center; color: red;">Error loading data. Please try again later.</td></tr>';
    }
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

function populateSnapshotSelector() {
    const select = document.getElementById('snapshot-filter');
    if (!select) return;

    select.innerHTML = '<option value="current">Current Rankings</option>';

    // Add snapshots in reverse chronological order (most recent first after Current)
    // Filter to only "After DEs" snapshots for cleaner list
    const deSnapshots = timelineData.filter(s => s.phase === 'After DEs');

    // Store for later use
    window.deSnapshotsCache = deSnapshots;

    for (let i = deSnapshots.length - 1; i >= 0; i--) {
        const snapshot = deSnapshots[i];
        const date = new Date(snapshot.date);
        const formattedDate = date.toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const option = document.createElement('option');
        option.value = i; // This is the actual index in deSnapshots array
        option.textContent = formattedDate;
        select.appendChild(option);
    }
}

function applyActivityFilter() {
    const filterValue = currentActivityFilter;
    let sourceData;
    const isSnapshot = currentSnapshot !== null;

    // Determine source data: current ratings or snapshot
    if (currentSnapshot === null) {
        sourceData = ratingsData;
        // Update title for current view
        document.getElementById('rankings-title').textContent = 'Current Rankings';
        document.getElementById('rankings-description').textContent = 'Elo ratings for all fencers based on tournament results. Ratings are updated after each session.';
    } else {
        // Get snapshot data from cached array
        const deSnapshots = window.deSnapshotsCache || timelineData.filter(s => s.phase === 'After DEs');
        const snapshot = deSnapshots[currentSnapshot];

        if (snapshot) {
            sourceData = Object.entries(snapshot.ratings).map(([fencer, rating]) => ({
                fencer: fencer,
                rating: rating,
                matches: snapshot.match_counts ? (snapshot.match_counts[fencer] || 0) : 0,
                max_elo: snapshot.max_elos ? (snapshot.max_elos[fencer] || 0) : 0,
                active_status: snapshot.active_status[fencer] || 'Inactive',
                recent_participation: snapshot.recent_participation ? (snapshot.recent_participation[fencer] || 0) : 0
            }));
            // Sort by rating descending
            sourceData.sort((a, b) => b.rating - a.rating);

            // Update title for snapshot view
            const date = new Date(snapshot.date);
            const formattedDate = date.toLocaleDateString('en-GB', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            document.getElementById('rankings-title').textContent = `Historical Snapshot - ${formattedDate}`;
            document.getElementById('rankings-description').textContent = 'Rankings as they appeared after this tournament session.';
        } else {
            sourceData = ratingsData;
        }
    }

    let filteredData = sourceData;

    if (filterValue === 'active') {
        // Show only Active fencers
        filteredData = sourceData.filter(f => f.active_status === 'Active');
    } else if (filterValue === 'semi-active') {
        // Show Active and Semi-active fencers
        filteredData = sourceData.filter(f =>
            f.active_status === 'Active' || f.active_status === 'Semi-active'
        );
    }
    // 'all' shows everyone

    displayRatings(filteredData, isSnapshot);
}

function displayRatings(data, isSnapshot = false) {
    // Destroy existing DataTable first
    if ($.fn.DataTable.isDataTable('#ratings-table')) {
        $('#ratings-table').DataTable().destroy();
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

        // Status badge styling with participation count
        let statusBadge = '';
        if (fencer.active_status) {
            let statusClass = 'status-inactive';
            if (fencer.active_status === 'Active') {
                statusClass = 'status-active';
            } else if (fencer.active_status === 'Semi-active') {
                statusClass = 'status-semi-active';
            }
            const participation = fencer.recent_participation || 0;
            statusBadge = `<span class="status-badge ${statusClass}" title="${participation} out of last 40 sessions">${fencer.active_status} (${participation}/40)</span>`;
        } else {
            statusBadge = '<span style="color: #999;">N/A</span>';
        }

        // Get max elo - from snapshot data if available, otherwise from stats
        let maxElo = '-';
        if (isSnapshot && fencer.max_elo && fencer.max_elo > 0) {
            // Use max elo from snapshot
            maxElo = fencer.max_elo.toFixed(1);
        } else if (!isSnapshot) {
            // Use current all-time max from stats
            const statsInfo = fencerStatsData.find(f => f.Fencer === fencer.fencer);
            if (statsInfo && statsInfo['Max Elo (All-Time)']) {
                const maxEloValue = parseFloat(statsInfo['Max Elo (All-Time)']);
                if (!isNaN(maxEloValue)) {
                    maxElo = maxEloValue.toFixed(1);
                }
            }
        }

        const participation = fencer.recent_participation || 0;
        const matchesDisplay = fencer.matches > 0 ? fencer.matches : '-';

        row.innerHTML = `
            <td class="${rankClass}">${rank}</td>
            <td><a href="fencer.html?fencer=${encodeURIComponent(fencer.fencer)}" class="fencer-link">${fencer.fencer}</a></td>
            <td data-order="${participation}">${statusBadge}</td>
            <td><strong>${fencer.rating}</strong></td>
            <td>${maxElo}</td>
            <td>${matchesDisplay}</td>
        `;
        tbody.appendChild(row);
    });

    // Initialize DataTable
    dataTable = $('#ratings-table').DataTable({
        paging: true,
        searching: true,
        ordering: true,
        pageLength: 25,
        order: [[3, 'desc']], // Sort by current rating column (descending) by default
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
