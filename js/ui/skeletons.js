// ============================================================
// SKELETONS UI - Skeleton loaders for content placeholders
// ============================================================

// Create skeleton card
function createSkeletonCard() {
    const card = document.createElement('div');
    card.className = 'skeleton-card';
    card.innerHTML = `
        <div class="skeleton-line" style="height: 120px; margin-bottom: 12px; border-radius: 8px;"></div>
        <div class="skeleton-line" style="height: 20px; width: 80%; margin-bottom: 8px;"></div>
        <div class="skeleton-line" style="height: 14px; width: 60%; margin-bottom: 6px;"></div>
        <div class="skeleton-line" style="height: 12px; width: 40%;"></div>
    `;
    return card;
}

// Create skeleton table row
function createSkeletonTableRow(columnCount = 5) {
    const row = document.createElement('tr');
    for (let i = 0; i < columnCount; i++) {
        const td = document.createElement('td');
        td.innerHTML = '<div class="skeleton-line" style="height: 16px;"></div>';
        row.appendChild(td);
    }
    return row;
}

// Create skeleton table
function createSkeletonTable(rows = 5, columns = 5) {
    const table = document.createElement('table');
    table.className = 'data-table';

    const tbody = document.createElement('tbody');
    for (let i = 0; i < rows; i++) {
        tbody.appendChild(createSkeletonTableRow(columns));
    }
    table.appendChild(tbody);

    return table;
}

// Create skeleton list item
function createSkeletonListItem() {
    const item = document.createElement('div');
    item.className = 'skeleton-list-item';
    item.innerHTML = `
        <div class="skeleton-avatar"></div>
        <div style="flex: 1;">
            <div class="skeleton-line" style="height: 16px; width: 60%; margin-bottom: 8px;"></div>
            <div class="skeleton-line" style="height: 12px; width: 40%;"></div>
        </div>
        <div class="skeleton-line" style="height: 32px; width: 80px;"></div>
    `;
    return item;
}

// Create skeleton stats grid
function createSkeletonStatsGrid(count = 4) {
    const container = document.createElement('div');
    container.className = 'stats-grid';

    for (let i = 0; i < count; i++) {
        const card = document.createElement('div');
        card.className = 'stat-card skeleton';
        card.style.height = '100px';
        container.appendChild(card);
    }

    return container;
}

// Create skeleton chart
function createSkeletonChart(height = 300) {
    const container = document.createElement('div');
    container.className = 'skeleton-chart';
    container.style.height = `${height}px`;
    return container;
}

// Create skeleton profile header
function createSkeletonProfileHeader() {
    const container = document.createElement('div');
    container.className = 'skeleton-profile-header';
    container.style.display = 'flex';
    container.style.gap = '20px';
    container.style.marginBottom = '24px';
    container.innerHTML = `
        <div class="skeleton-avatar" style="width: 100px; height: 100px; border-radius: 50%;"></div>
        <div style="flex: 1;">
            <div class="skeleton-line" style="height: 28px; width: 60%; margin-bottom: 12px;"></div>
            <div class="skeleton-line" style="height: 16px; width: 40%; margin-bottom: 8px;"></div>
            <div class="skeleton-line" style="height: 14px; width: 50%;"></div>
        </div>
    `;
    return container;
}

// Fill container with skeleton cards
function fillWithSkeletonCards(container, count = 3, cardCreator = null) {
    if (!container) return;
    container.innerHTML = '';
    const creator = cardCreator || createSkeletonCard;
    for (let i = 0; i < count; i++) {
        container.appendChild(creator());
    }
}

// Fill container with skeleton table rows
function fillWithSkeletonRows(tableElement, rows = 5, columns = null) {
    if (!tableElement) return;
    const tbody = tableElement.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const columnCount = columns || (tableElement.querySelector('thead tr')?.children.length || 5);
    for (let i = 0; i < rows; i++) {
        tbody.appendChild(createSkeletonTableRow(columnCount));
    }
}

// Replace skeletons with actual content
function replaceSkeletons(container, contentGenerator) {
    if (!container) return;
    container.innerHTML = '';
    contentGenerator(container);
}

// Skeleton loader for marks entry table
function showMarksEntrySkeleton(container, studentCount = 20) {
    if (!container) return;

    let skeletonHtml = `
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Student Name</th>
                        <th>Score</th>
                        <th>/Max</th>
                        <th>%</th>
                        <th>Grade</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    `;

    for (let i = 1; i <= Math.min(studentCount, 10); i++) {
        skeletonHtml += `
            <tr>
                <td>${i}</td>
                <td><div class="skeleton-line" style="height: 16px; width: 120px;"></div></td>
                <td><div class="skeleton-line" style="height: 32px; width: 70px;"></div></td>
                <td>50</td>
                <td><div class="skeleton-line" style="height: 14px; width: 40px;"></div></td>
                <td><div class="skeleton-line" style="height: 20px; width: 35px;"></div></td>
                <td><div class="skeleton-line" style="height: 20px; width: 50px;"></div></td>
            </tr>
        `;
    }

    skeletonHtml += `</tbody></table></div>`;
    container.innerHTML = skeletonHtml;
}

// Skeleton loader for dashboard stats
function showDashboardSkeleton(container) {
    if (!container) return;

    container.innerHTML = `
        <div class="stats-grid">
            ${'<div class="stat-card skeleton" style="height: 100px;"></div>'.repeat(5)}
        </div>
        <div class="two-col">
            <div class="dash-card skeleton" style="height: 300px;"></div>
            <div class="dash-card skeleton" style="height: 300px;"></div>
        </div>
    `;
}