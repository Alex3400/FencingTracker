// Timeline chart for ELO ratings
let timelineData = [];
let ratingsData = [];
let chart = null;

// Color palette for different fencers
const COLORS = [
    '#2c5aa0', '#e74c3c', '#27ae60', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b',
    '#d35400', '#8e44ad', '#2980b9', '#27ae60', '#f1c40f'
];

async function loadData() {
    try {
        const [timelineResponse, ratingsResponse] = await Promise.all([
            fetch('data/elo_timeline.json'),
            fetch('data/elo_ratings.json')
        ]);

        timelineData = await timelineResponse.json();
        ratingsData = await ratingsResponse.json();

        populateFencerSelect();
        initializeChart();
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading timeline data. Please try again later.');
    }
}

function populateFencerSelect() {
    const select = document.getElementById('fencer-select');
    select.innerHTML = '';

    // Sort fencers by current rating
    const sortedFencers = [...ratingsData].sort((a, b) => b.rating - a.rating);

    sortedFencers.forEach(fencer => {
        const option = document.createElement('option');
        option.value = fencer.fencer;
        option.textContent = `${fencer.fencer} (${fencer.rating})`;
        select.appendChild(option);
    });
}

function initializeChart() {
    const ctx = document.getElementById('elo-chart').getContext('2d');

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: 'ELO Rating Progression',
                    font: { size: 18 }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}`;
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

function updateChart() {
    const select = document.getElementById('fencer-select');
    const selectedFencers = Array.from(select.selectedOptions).map(opt => opt.value);

    if (selectedFencers.length === 0) {
        chart.data.labels = [];
        chart.data.datasets = [];
        chart.update();
        return;
    }

    // Build labels (dates + phases)
    const labels = timelineData.map(snapshot => `${snapshot.date} ${snapshot.phase}`);

    // Build datasets for each selected fencer
    const datasets = selectedFencers.map((fencer, index) => {
        const data = timelineData.map(snapshot => {
            return snapshot.ratings[fencer] || null;
        });

        return {
            label: fencer,
            data: data,
            borderColor: COLORS[index % COLORS.length],
            backgroundColor: COLORS[index % COLORS.length] + '33',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.1,
            spanGaps: true // Connect line even if fencer wasn't present
        };
    });

    chart.data.labels = labels;
    chart.data.datasets = datasets;
    chart.update();
}

function selectTop5() {
    const select = document.getElementById('fencer-select');

    // Clear current selection
    for (let option of select.options) {
        option.selected = false;
    }

    // Select top 5
    for (let i = 0; i < Math.min(5, select.options.length); i++) {
        select.options[i].selected = true;
    }

    updateChart();
}

function clearSelection() {
    const select = document.getElementById('fencer-select');
    for (let option of select.options) {
        option.selected = false;
    }
    updateChart();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadData();

    document.getElementById('fencer-select').addEventListener('change', updateChart);
    document.getElementById('top-5-btn').addEventListener('click', selectTop5);
    document.getElementById('clear-btn').addEventListener('click', clearSelection);
});
