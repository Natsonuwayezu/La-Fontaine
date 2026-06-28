// js/mobile/mobile-tables.js
// Mobile Tables Module - Responsive table handling for mobile devices

export function initMobileTables() {
    if (!isMobileDevice()) return;

    enhanceAllTables();
    addResponsiveWrappers();
    initTableSwipe();
}

function isMobileDevice() {
    return window.innerWidth <= 768;
}

function enhanceAllTables() {
    const tables = document.querySelectorAll('table:not(.data-table-enhanced)');

    tables.forEach(table => {
        table.classList.add('data-table-enhanced');

        // Convert to card view on very small screens
        if (window.innerWidth <= 480) {
            convertTableToCards(table);
        }

        // Add sticky header for long tables
        if (table.querySelectorAll('tr').length > 10) {
            makeHeaderSticky(table);
        }

        // Add data-label attributes for responsive display
        addDataLabels(table);
    });
}

function convertTableToCards(table) {
    const container = table.parentElement;
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
    const rows = table.querySelectorAll('tbody tr');

    if (rows.length === 0) return;

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'mobile-cards-container';
    cardsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) return;

        const card = document.createElement('div');
        card.className = 'mobile-card';
        card.style.cssText = `
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: 12px;
            padding: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        `;

        cells.forEach((cell, idx) => {
            if (idx < headers.length && headers[idx]) {
                const field = document.createElement('div');
                field.style.cssText = 'display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-light);';
                field.innerHTML = `
                    <span style="font-weight: 600; color: var(--text-secondary);">${headers[idx]}:</span>
                    <span>${cell.innerHTML}</span>
                `;
                card.appendChild(field);
            }
        });

        // Copy action buttons
        const actionCell = cells[cells.length - 1];
        if (actionCell && actionCell.querySelectorAll('button').length) {
            const actions = document.createElement('div');
            actions.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; padding-top: 8px;';
            actions.innerHTML = actionCell.innerHTML;
            card.appendChild(actions);
        }

        cardsContainer.appendChild(card);
    });

    // Hide original table, show cards
    table.style.display = 'none';
    container.appendChild(cardsContainer);

    // Store reference to revert if needed
    table._cardsContainer = cardsContainer;
}

function addDataLabels(table) {
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
    const rows = table.querySelectorAll('tbody tr');

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, idx) => {
            if (idx < headers.length && headers[idx]) {
                cell.setAttribute('data-label', headers[idx]);
            }
        });
    });
}

function makeHeaderSticky(table) {
    const thead = table.querySelector('thead');
    if (thead) {
        thead.style.position = 'sticky';
        thead.style.top = '0';
        thead.style.zIndex = '10';
        thead.style.background = 'var(--bg-secondary)';
    }
}

function addResponsiveWrappers() {
    const tables = document.querySelectorAll('table');

    tables.forEach(table => {
        if (!table.parentElement.classList.contains('table-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            wrapper.style.cssText = `
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
                margin: 12px 0;
            `;
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });
}

function initTableSwipe() {
    const wrappers = document.querySelectorAll('.table-wrapper');

    wrappers.forEach(wrapper => {
        let startX = 0;
        let scrollLeft = 0;

        wrapper.addEventListener('touchstart', function (e) {
            startX = e.touches[0].pageX - wrapper.offsetLeft;
            scrollLeft = wrapper.scrollLeft;
        });

        wrapper.addEventListener('touchmove', function (e) {
            const x = e.touches[0].pageX - wrapper.offsetLeft;
            const walk = (x - startX) * 1.5;
            wrapper.scrollLeft = scrollLeft - walk;
        });
    });
}

export function resetTableDisplay() {
    const tables = document.querySelectorAll('.data-table-enhanced');

    tables.forEach(table => {
        if (table._cardsContainer) {
            table._cardsContainer.remove();
            table.style.display = '';
            delete table._cardsContainer;
        }
    });
}

export function handleOrientationChange() {
    if (window.innerWidth <= 480) {
        const tables = document.querySelectorAll('.data-table-enhanced');
        tables.forEach(table => {
            if (!table._cardsContainer) {
                convertTableToCards(table);
            }
        });
    } else {
        const tables = document.querySelectorAll('.data-table-enhanced');
        tables.forEach(table => {
            if (table._cardsContainer) {
                table._cardsContainer.remove();
                table.style.display = '';
                delete table._cardsContainer;
            }
        });
    }
}

// Listen for orientation changes
window.addEventListener('resize', function () {
    setTimeout(handleOrientationChange, 100);
});