// ============================================================
// LOADERS UI - Loading indicators and spinners
// ============================================================

// Show full page loader
function showPageLoader() {
    let loader = document.getElementById('page-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'page-loader';
        loader.className = 'page-loader';
        loader.innerHTML = '<div class="loader-spinner"></div><p>Loading...</p>';
        document.body.appendChild(loader);
    }
    loader.style.display = 'flex';
    return loader;
}

// Hide full page loader
function hidePageLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
            loader.style.opacity = '';
        }, 300);
    }
}

// Show content loader (spinner in container)
function showContentLoader(container, message = 'Loading...') {
    if (!container) return null;

    const loader = document.createElement('div');
    loader.className = 'loader-container';
    loader.innerHTML = `<div class="loader-spinner"></div><p>${escapeHtml(message)}</p>`;
    container.innerHTML = '';
    container.appendChild(loader);
    return loader;
}

// Show table loader (skeleton rows)
function showTableLoader(tableElement, rowCount = 5, columnCount = 5) {
    if (!tableElement) return;

    const tbody = tableElement.querySelector('tbody');
    if (!tbody) return;

    let skeletonRows = '';
    for (let i = 0; i < rowCount; i++) {
        skeletonRows += '<tr>';
        for (let j = 0; j < columnCount; j++) {
            skeletonRows += '<td><div class="skeleton-line" style="height: 16px;"></div></td>';
        }
        skeletonRows += '</tr>';
    }

    tbody.innerHTML = skeletonRows;
}

// Show card loader (skeleton cards)
function showCardLoader(container, cardCount = 3) {
    if (!container) return;

    let cardsHtml = '';
    for (let i = 0; i < cardCount; i++) {
        cardsHtml += `
            <div class="skeleton-card">
                <div class="skeleton-line" style="height: 120px; margin-bottom: 12px;"></div>
                <div class="skeleton-line" style="height: 16px; width: 80%; margin-bottom: 8px;"></div>
                <div class="skeleton-line" style="height: 12px; width: 60%;"></div>
            </div>
        `;
    }

    container.innerHTML = cardsHtml;
}

// Create an inline spinner
function createSpinner(size = 'sm') {
    const spinner = document.createElement('div');
    const sizeClass = size === 'sm' ? 'loader-spinner-sm' : (size === 'lg' ? 'loader-spinner-lg' : 'loader-spinner');
    spinner.className = sizeClass;
    return spinner;
}

// Create dots loader
function createDotsLoader() {
    const loader = document.createElement('div');
    loader.className = 'loader-dots';
    loader.innerHTML = '<span></span><span></span><span></span>';
    return loader;
}

// Show button loading state
function setButtonLoading(button, isLoading, text = null) {
    if (!button) return;

    if (isLoading) {
        button._originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = text || '<span class="loader-inline"></span> Loading...';
    } else {
        button.disabled = false;
        button.innerHTML = button._originalText || text || 'Submit';
    }
}

// Show inline loader for a specific element
function showInlineLoader(element) {
    if (!element) return;

    const originalContent = element.innerHTML;
    element.dataset.originalContent = originalContent;
    element.innerHTML = '<span class="loader-inline"></span>';
    element.disabled = true;

    return () => {
        element.innerHTML = element.dataset.originalContent || originalContent;
        element.disabled = false;
        delete element.dataset.originalContent;
    };
}

// Helper function
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Expose globally
window.showPageLoader = showPageLoader;
window.hidePageLoader = hidePageLoader;
window.setButtonLoading = setButtonLoading;