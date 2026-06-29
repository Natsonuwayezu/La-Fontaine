// ============================================================
// TABLES UI - Smart table component with sorting, filtering, pagination
// ============================================================


// SmartTable class - Reusable table component
class SmartTable {
    constructor(container, options) {
        this.container = container;
        this.options = {
            columns: [],
            data: [],
            pageSize: 20,
            sortable: true,
            searchable: true,
            selectable: false,
            exportable: false,
            ...options
        };
        this.currentPage = 1;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.searchTerm = '';
        this.selectedRows = new Set();
        this.render();
    }

    render() {
        // Filter data
        let filtered = this.filterData();

        // Sort data
        if (this.sortColumn) {
            filtered = this.sortData(filtered);
        }

        // Paginate
        const totalPages = Math.ceil(filtered.length / this.options.pageSize);
        const start = (this.currentPage - 1) * this.options.pageSize;
        const paginated = filtered.slice(start, start + this.options.pageSize);

        // Build HTML
        let html = '';

        // Search bar
        if (this.options.searchable) {
            html += `
                <div class="table-search" style="margin-bottom: 12px;">
                    <input type="text" class="form-control" placeholder="🔍 Search..." 
                           data-table-search="${this.container.id}" value="${this.searchTerm}" style="width: 100%; padding: 8px 12px;">
                </div>
            `;
        }

        // Table
        html += `<div class="table-wrapper"><table class="data-table">`;

        // Header
        html += '<thead></td>';
        if (this.options.selectable) {
            html += `<th style="width: 40px"><input type="checkbox" data-select-all="${this.container.id}"></th>`;
        }
        for (const col of this.options.columns) {
            const sortIcon = (this.sortColumn === col.key) ? (this.sortDirection === 'asc' ? ' ↑' : ' ↓') : '';
            html += `<th data-sort="${col.key}" style="cursor: pointer">${col.label}${this.options.sortable ? sortIcon : ''}</th>`;
        }
        html += '</thead>';

        // Body
        html += '<tbody>';
        for (let i = 0; i < paginated.length; i++) {
            const row = paginated[i];
            html += '<tr>';
            if (this.options.selectable) {
                html += `<td><input type="checkbox" data-row-id="${row.id}" ${this.selectedRows.has(row.id) ? 'checked' : ''}></td>`;
            }
            for (const col of this.options.columns) {
                let value = this.getNestedValue(row, col.key);
                if (col.formatter) value = col.formatter(value, row);
                html += `<td>${value || '—'}</td>`;
            }
            html += '</tr>';
        }
        if (paginated.length === 0) {
            html += `<tr><td colspan="${this.options.columns.length + (this.options.selectable ? 1 : 0)}" style="text-align:center; padding: 40px;">No data available</td></tr>`;
        }
        html += '</tbody>';

        // Footer with pagination
        html += `<tfoot><tr><td colspan="${this.options.columns.length + (this.options.selectable ? 1 : 0)}"><div class="pagination">`;
        for (let i = 1; i <= Math.min(totalPages, 5); i++) {
            html += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        if (totalPages > 5) {
            html += `<span>...</span>`;
            html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
        }
        html += `</div></td></tr></tfoot>`;

        html += '</table></div>';

        this.container.innerHTML = html;
        this.attachEvents();
    }

    filterData() {
        if (!this.searchTerm) return [...this.options.data];

        return this.options.data.filter(row => {
            const searchable = this.options.columns
                .filter(c => c.searchable !== false)
                .map(c => String(this.getNestedValue(row, c.key) || ''))
                .join(' ')
                .toLowerCase();
            return searchable.includes(this.searchTerm.toLowerCase());
        });
    }

    sortData(data) {
        return [...data].sort((a, b) => {
            let aVal = this.getNestedValue(a, this.sortColumn);
            let bVal = this.getNestedValue(b, this.sortColumn);

            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }

            aVal = String(aVal || '').toLowerCase();
            bVal = String(bVal || '').toLowerCase();
            const cmp = aVal.localeCompare(bVal);
            return this.sortDirection === 'asc' ? cmp : -cmp;
        });
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    attachEvents() {
        // Search
        const searchInput = this.container.querySelector(`[data-table-search="${this.container.id}"]`);
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                this.currentPage = 1;
                this.render();
            });
        }

        // Sort
        if (this.options.sortable) {
            this.container.querySelectorAll('[data-sort]').forEach(el => {
                el.addEventListener('click', (e) => {
                    const key = el.dataset.sort;
                    if (this.sortColumn === key) {
                        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                    } else {
                        this.sortColumn = key;
                        this.sortDirection = 'asc';
                    }
                    this.render();
                });
            });
        }

        // Pagination
        this.container.querySelectorAll('[data-page]').forEach(el => {
            el.addEventListener('click', (e) => {
                this.currentPage = parseInt(el.dataset.page);
                this.render();
            });
        });

        // Select all
        const selectAll = this.container.querySelector('[data-select-all]');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                const checked = e.target.checked;
                const rows = this.filterData();
                const start = (this.currentPage - 1) * this.options.pageSize;
                const paginated = rows.slice(start, start + this.options.pageSize);

                paginated.forEach(row => {
                    if (checked) this.selectedRows.add(row.id);
                    else this.selectedRows.delete(row.id);
                });
                this.render();
                if (this.options.onSelectionChange) {
                    this.options.onSelectionChange([...this.selectedRows]);
                }
            });
        }

        // Individual row selection
        this.container.querySelectorAll('[data-row-id]').forEach(el => {
            el.addEventListener('change', (e) => {
                const id = parseInt(el.dataset.rowId);
                if (e.target.checked) this.selectedRows.add(id);
                else this.selectedRows.delete(id);
                if (this.options.onSelectionChange) {
                    this.options.onSelectionChange([...this.selectedRows]);
                }
            });
        });
    }

    updateData(newData) {
        this.options.data = newData;
        this.currentPage = 1;
        this.selectedRows.clear();
        this.render();
    }

    getSelectedIds() {
        return [...this.selectedRows];
    }

    exportToExcel(filename) {
        const data = this.filterData();
        if (data.length === 0) {
            showToast('No data to export', 'warning');
            return;
        }

        const exportData = data.map(row => {
            const obj = {};
            for (const col of this.options.columns) {
                obj[col.label] = this.getNestedValue(row, col.key);
            }
            return obj;
        });

        exportToExcel(exportData, filename || 'table_export');
    }
}

// Create a new smart table
function createTable(containerId, options) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    return new SmartTable(container, options);
}

// Render a simple HTML table from data
function renderSimpleTable(container, columns, data) {
    if (!container) return;

    let html = '<div class="table-wrapper"><table class="data-table"><thead><tr>';
    for (const col of columns) {
        html += `<th>${col}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const row of data) {
        html += '<tr>';
        for (const col of columns) {
            html += `<td>${row[col] || '—'}</td>`;
        }
        html += '</tr>';
    }

    if (data.length === 0) {
        html += `<tr><td colspan="${columns.length}" style="text-align:center;padding:40px;">No data available</td></tr>`;
    }

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Export table to Excel
function exportTableToExcel(tableElement, filename) {
    const ws = XLSX.utils.table_to_sheet(tableElement);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('✅ Table exported', 'success');
}