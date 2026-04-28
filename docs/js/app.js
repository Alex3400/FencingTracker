// Load and display ELO ratings
let ratingsData = [];
let dataTable = null;

async function loadRatings() {
    try {
        const response = await fetch('data/elo_ratings.json');
        ratingsData = await response.json();
        displayRatings(ratingsData);
        updateLastUpdate();
    } catch (error) {
        console.error('Error loading ratings:', error);
        document.getElementById('ratings-body').innerHTML =
            '<tr><td colspan="5" style="text-align: center; color: red;">Error loading data. Please try again later.</td></tr>';
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
            <td><span class="badge ${fencer.status.toLowerCase()}">${fencer.status}</span></td>
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

function filterByStatus(status) {
    let filtered;

    if (status === 'established') {
        filtered = ratingsData.filter(f => f.status === 'Established');
    } else {
        // 'all' - show everyone
        filtered = ratingsData;
    }

    displayRatings(filtered);
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

    // Filter radio buttons
    document.querySelectorAll('input[name="status-filter"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            filterByStatus(e.target.value);
        });
    });
});
