// js/integrations/chartjs.js
// Chart.js Integration - Chart management and utilities

// Chart instance registry to prevent duplicates
const chartRegistry = new Map();

function initChartIntegration() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded');
        return false;
    }
    return true;
}

function createChart(ctx, type, data, options = {}) {
    if (!initChartIntegration()) return null;

    // Destroy existing chart if it exists
    const existingChart = chartRegistry.get(ctx);
    if (existingChart) {
        existingChart.destroy();
        chartRegistry.delete(ctx);
    }

    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    font: { family: "'DM Sans', sans-serif", size: 11 },
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0,0,0,0.8)',
                titleFont: { family: "'DM Sans', sans-serif", size: 12 },
                bodyFont: { family: "'DM Sans', sans-serif", size: 11 },
                callbacks: {
                    label: function (context) {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        if (context.parsed.y !== undefined) {
                            label += formatValue(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        }
    };

    const mergedOptions = mergeDeep(defaultOptions, options);
    const chart = new Chart(ctx, {
        type: type,
        data: data,
        options: mergedOptions
    });

    chartRegistry.set(ctx, chart);
    return chart;
}

function createBarChart(ctx, labels, datasets, options = {}) {
    const data = { labels, datasets };
    return createChart(ctx, 'bar', data, options);
}

function createLineChart(ctx, labels, datasets, options = {}) {
    const data = { labels, datasets };
    return createChart(ctx, 'line', data, options);
}

function createPieChart(ctx, labels, dataValues, colors = null, options = {}) {
    const defaultColors = ['#1a3a5c', '#3b82f6', '#0d9488', '#14b8a6', '#7c3aed', '#ec4899', '#f59e0b', '#10b981'];
    const backgroundColor = colors || labels.map((_, i) => defaultColors[i % defaultColors.length]);

    const data = {
        labels: labels,
        datasets: [{
            data: dataValues,
            backgroundColor: backgroundColor,
            borderWidth: 0
        }]
    };

    return createChart(ctx, 'doughnut', data, options);
}

function createDoughnutChart(ctx, labels, dataValues, colors = null, options = {}) {
    return createPieChart(ctx, labels, dataValues, colors, options);
}

function destroyChart(ctx) {
    const chart = chartRegistry.get(ctx);
    if (chart) {
        chart.destroy();
        chartRegistry.delete(ctx);
    }
}

function destroyAllCharts() {
    for (const [ctx, chart] of chartRegistry.entries()) {
        chart.destroy();
    }
    chartRegistry.clear();
}

function updateChart(ctx, newData, newLabels = null) {
    const chart = chartRegistry.get(ctx);
    if (!chart) return false;

    if (newLabels) chart.data.labels = newLabels;
    chart.data.datasets = newData.datasets || newData;
    chart.update();
    return true;
}

function getChartColors(count) {
    const colors = [
        '#1a3a5c', '#3b82f6', '#0d9488', '#14b8a6', '#7c3aed',
        '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
        '#06b6d4', '#84cc16', '#f97316', '#d946ef', '#14b8a6'
    ];

    if (count <= colors.length) return colors.slice(0, count);

    // Generate more colors if needed
    const result = [...colors];
    for (let i = colors.length; i < count; i++) {
        const hue = (i * 137) % 360;
        result.push(`hsl(${hue}, 65%, 55%)`);
    }
    return result;
}

function formatValue(value) {
    if (typeof value === 'number') {
        if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
        if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
        return value.toLocaleString();
    }
    return value;
}

function mergeDeep(target, source) {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    output[key] = source[key];
                } else {
                    output[key] = mergeDeep(target[key], source[key]);
                }
            } else {
                output[key] = source[key];
            }
        });
    }
    return output;
}

function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

// Theme-aware chart update
function updateChartTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    for (const [ctx, chart] of chartRegistry.entries()) {
        if (chart.options) {
            if (chart.options.plugins?.legend?.labels) {
                chart.options.plugins.legend.labels.color = textColor;
            }
            if (chart.options.scales) {
                Object.values(chart.options.scales).forEach(scale => {
                    if (scale.title) scale.title.color = textColor;
                    if (scale.ticks) scale.ticks.color = textColor;
                    if (scale.grid) scale.grid.color = gridColor;
                });
            }
            chart.update();
        }
    }
}

// Listen for theme changes
document.addEventListener('themeChanged', updateChartTheme);