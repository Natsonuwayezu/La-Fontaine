// ============================================================
// CHARTS UI - Chart.js wrapper and chart management
// ============================================================

let chartInstances = {};

// Create a bar chart
function createBarChart(canvasId, labels, datasets, options = {}) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;

    // Destroy existing chart
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { position: 'top' },
            tooltip: { mode: 'index', intersect: false }
        }
    };

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: { ...defaultOptions, ...options }
    });

    return chartInstances[canvasId];
}

// Create a line chart
function createLineChart(canvasId, labels, datasets, options = {}) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { position: 'top' },
            tooltip: { mode: 'index', intersect: false }
        }
    };

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: { ...defaultOptions, ...options }
    });

    return chartInstances[canvasId];
}

// Create a pie/doughnut chart
function createPieChart(canvasId, labels, data, colors, type = 'doughnut') {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    chartInstances[canvasId] = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'right' },
                tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw}%` } }
            }
        }
    });

    return chartInstances[canvasId];
}

// Update chart data
function updateChart(canvasId, labels, datasets) {
    const chart = chartInstances[canvasId];
    if (!chart) return;

    chart.data.labels = labels;
    chart.data.datasets = datasets;
    chart.update();
}

// Destroy chart
function destroyChart(canvasId) {
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
        delete chartInstances[canvasId];
    }
}

// Destroy all charts
function destroyAllCharts() {
    for (const id in chartInstances) {
        chartInstances[id].destroy();
    }
    chartInstances = {};
}

// Create fee collection chart (for admin dashboard)
function createFeeCollectionChart(canvasId, classNames, expectedData, collectedData) {
    return createBarChart(canvasId, classNames, [
        {
            label: 'Expected (M RWF)',
            data: expectedData,
            backgroundColor: 'rgba(26, 58, 92, 0.5)',
            borderRadius: 6
        },
        {
            label: 'Collected (M RWF)',
            data: collectedData,
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderRadius: 6
        }
    ], {
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Millions RWF' } } }
    });
}

// Create class performance comparison chart
function createClassPerformanceChart(canvasId, classNames, term1Data, term2Data, term3Data) {
    return createLineChart(canvasId, classNames, [
        { label: 'Term 1', data: term1Data, borderColor: '#3b82f6', backgroundColor: 'transparent', tension: 0.3 },
        { label: 'Term 2', data: term2Data, borderColor: '#10b981', backgroundColor: 'transparent', tension: 0.3 },
        { label: 'Term 3', data: term3Data, borderColor: '#f59e0b', backgroundColor: 'transparent', tension: 0.3 }
    ], {
        scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Average %' } } }
    });
}

// Create monthly collection trend chart
function createMonthlyTrendChart(canvasId, months, amounts) {
    return createLineChart(canvasId, months, [{
        label: 'Collected (RWF)',
        data: amounts,
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13, 148, 136, 0.15)',
        fill: true,
        tension: 0.4
    }], {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { callback: (v) => fmtCurrency(v) } } }
    });
}

// Helper function
function fmtCurrency(n) {
    return n.toLocaleString() + ' RWF';
}