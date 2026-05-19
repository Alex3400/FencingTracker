// Monthly Improvement Tracker
let monthlyData = [];

async function loadMonthlyData() {
    try {
        const response = await fetch('data/monthly_improvements.json');
        monthlyData = await response.json();
        displayMonthlyImprovements();
    } catch (error) {
        console.error('Error loading monthly data:', error);
        document.getElementById('monthly-improvements').innerHTML =
            '<p style="text-align: center; color: red;">Error loading data. Please try again later.</p>';
    }
}

function displayMonthlyImprovements() {
    const container = document.getElementById('monthly-improvements');
    container.innerHTML = '';

    monthlyData.forEach(month => {
        const monthSection = document.createElement('div');
        monthSection.className = 'month-section';

        // Month header
        const header = document.createElement('div');
        header.className = 'month-header';
        header.innerHTML = `
            <h3>${month.month_name}</h3>
            <p>${month.session_count} session${month.session_count > 1 ? 's' : ''} -
            ${month.fencer_changes.length} fencer${month.fencer_changes.length > 1 ? 's' : ''}</p>
        `;
        monthSection.appendChild(header);

        // Sessions list
        const sessionsList = document.createElement('div');
        sessionsList.className = 'sessions-list';
        sessionsList.innerHTML = '<p><strong>Sessions:</strong> ' +
            month.session_dates.map(date => {
                const d = new Date(date);
                const formatted = d.toLocaleDateString('en-GB', {
                    month: 'short',
                    day: 'numeric'
                });
                return `<a href="sessions.html?date=${encodeURIComponent(date)}" class="date-link">${formatted}</a>`;
            }).join(', ') + '</p>';
        monthSection.appendChild(sessionsList);

        // Fencers table
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'month-table-wrapper';

        const table = document.createElement('table');
        table.className = 'month-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Fencer</th>
                    <th>Sessions</th>
                    <th>Start Elo</th>
                    <th>End Elo</th>
                    <th>Change</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');
        month.fencer_changes.forEach((fencer, index) => {
            const row = document.createElement('tr');

            // Determine change class and icon
            let changeClass = '';
            let changeIcon = '';
            if (fencer.change > 0) {
                changeClass = 'positive';
                changeIcon = '▲';
            } else if (fencer.change < 0) {
                changeClass = 'negative';
                changeIcon = '▼';
            } else {
                changeClass = '';
                changeIcon = '━';
            }

            const changeSign = fencer.change > 0 ? '+' : '';
            const sessionsText = `${fencer.sessions_attended || 0}/${month.session_count}`;

            row.innerHTML = `
                <td>${index + 1}</td>
                <td><a href="fencer.html?fencer=${encodeURIComponent(fencer.fencer)}" class="fencer-link">${fencer.fencer}</a></td>
                <td>${sessionsText}</td>
                <td>${fencer.start_rating}</td>
                <td><strong>${fencer.end_rating}</strong></td>
                <td class="${changeClass}">${changeIcon} ${changeSign}${fencer.change}</td>
            `;
            tbody.appendChild(row);
        });

        tableWrapper.appendChild(table);
        monthSection.appendChild(tableWrapper);

        container.appendChild(monthSection);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadMonthlyData();
});
