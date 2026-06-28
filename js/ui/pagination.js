// ============================================================
// PAGINATION UI - Pagination component for tables and lists
// ============================================================

// Pagination component class
export class Pagination {
    constructor(container, options = {}) {
        this.container = container;
        this.totalItems = options.totalItems || 0;
        this.itemsPerPage = options.itemsPerPage || 20;
        this.currentPage = options.currentPage || 1;
        this.maxButtons = options.maxButtons || 5;
        this.onPageChange = options.onPageChange || null;
        this.render();
    }

    getTotalPages() {
        return Math.ceil(this.totalItems / this.itemsPerPage);
    }

    getVisiblePages() {
        const totalPages = this.getTotalPages();
        const half = Math.floor(this.maxButtons / 2);
        let start = Math.max(1, this.currentPage - half);
        let end = Math.min(totalPages, start + this.maxButtons - 1);

        if (end - start + 1 < this.maxButtons) {
            start = Math.max(1, end - this.maxButtons + 1);
        }

        const pages = [];
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    }

    render() {
        const totalPages = this.getTotalPages();
        if (totalPages <= 1) {
            this.container.innerHTML = '';
            return;
        }

        let html = '<div class="pagination">';

        // First button
        html += `<button class="page-btn ${this.currentPage === 1 ? 'disabled' : ''}" data-page="1" ${this.currentPage === 1 ? 'disabled' : ''}>«</button>`;

        // Previous button
        html += `<button class="page-btn ${this.currentPage === 1 ? 'disabled' : ''}" data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''}>‹</button>`;

        // Page numbers
        const visiblePages = this.getVisiblePages();
        if (visiblePages[0] > 1) {
            html += `<button class="page-btn" data-page="1">1</button>`;
            if (visiblePages[0] > 2) {
                html += `<span class="pagination-ellipsis">...</span>`;
            }
        }

        for (const page of visiblePages) {
            html += `<button class="page-btn ${page === this.currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`;
        }

        if (visiblePages[visiblePages.length - 1] < totalPages) {
            if (visiblePages[visiblePages.length - 1] < totalPages - 1) {
                html += `<span class="pagination-ellipsis">...</span>`;
            }
            html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
        }

        // Next button
        html += `<button class="page-btn ${this.currentPage === totalPages ? 'disabled' : ''}" data-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? 'disabled' : ''}>›</button>`;

        // Last button
        html += `<button class="page-btn ${this.currentPage === totalPages ? 'disabled' : ''}" data-page="${totalPages}" ${this.currentPage === totalPages ? 'disabled' : ''}>»</button>`;

        html += '</div>';

        this.container.innerHTML = html;
        this.attachEvents();
    }

    attachEvents() {
        this.container.querySelectorAll('.page-btn:not(.disabled)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(btn.dataset.page);
                if (!isNaN(page) && page !== this.currentPage) {
                    this.goToPage(page);
                }
            });
        });
    }

    goToPage(page) {
        const totalPages = this.getTotalPages();
        if (page < 1 || page > totalPages) return;

        this.currentPage = page;
        this.render();

        if (this.onPageChange) {
            this.onPageChange(page);
        }
    }

    updateTotalItems(totalItems) {
        this.totalItems = totalItems;
        this.currentPage = 1;
        this.render();
    }

    setItemsPerPage(itemsPerPage) {
        this.itemsPerPage = itemsPerPage;
        this.currentPage = 1;
        this.render();
    }
}

// Create pagination for a table
export function createTablePagination(containerId, tableId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const table = document.getElementById(tableId);
    if (!table) return null;

    const tbody = table.querySelector('tbody');
    if (!tbody) return null;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    const itemsPerPage = options.itemsPerPage || 20;

    function showPage(page) {
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;

        rows.forEach((row, index) => {
            if (index >= start && index < end) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    const pagination = new Pagination(container, {
        totalItems: rows.length,
        itemsPerPage: itemsPerPage,
        currentPage: 1,
        onPageChange: (page) => showPage(page)
    });

    showPage(1);

    return pagination;
}

// Create pagination for data array
export function createArrayPagination(containerId, data, renderFn, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const itemsPerPage = options.itemsPerPage || 20;
    let currentData = [];

    function renderPage(page) {
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        currentData = data.slice(start, end);
        renderFn(currentData);
    }

    const pagination = new Pagination(container, {
        totalItems: data.length,
        itemsPerPage: itemsPerPage,
        currentPage: 1,
        onPageChange: (page) => renderPage(page)
    });

    renderPage(1);

    return pagination;
}

// Update pagination when data changes
export function updatePaginationData(paginationInstance, newTotalItems) {
    if (paginationInstance) {
        paginationInstance.updateTotalItems(newTotalItems);
    }
}