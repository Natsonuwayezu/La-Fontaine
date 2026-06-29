// ============================================================
// CARDS UI - Dashboard cards and statistics cards
// ============================================================


// Create a stat card
function createStatCard(icon, value, label, trend = null) {
    const card = document.createElement('div');
    card.className = 'stat-card';

    let trendHtml = '';
    if (trend) {
        const trendClass = trend.value > 0 ? 'up' : (trend.value < 0 ? 'down' : 'neutral');
        const trendIcon = trend.value > 0 ? '📈' : (trend.value < 0 ? '📉' : '📊');
        trendHtml = `<div class="stat-trend ${trendClass}">${trendIcon} ${Math.abs(trend.value)}% ${trend.text || ''}</div>`;
    }

    card.innerHTML = `
        <div class="stat-icon">${icon}</div>
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
        ${trendHtml}
    `;

    return card;
}

// Create a dashboard card
function createDashboardCard(title, content, actions = null) {
    const card = document.createElement('div');
    card.className = 'dash-card';

    let actionsHtml = '';
    if (actions) {
        actionsHtml = `<div class="btn-group">${actions}</div>`;
    }

    card.innerHTML = `
        <div class="dash-card-header">
            <span class="dash-card-title">${title}</span>
            ${actionsHtml}
        </div>
        <div class="dash-card-body">
            ${content}
        </div>
    `;

    return card;
}

// Create a quick action button
function createQuickAction(icon, title, subtitle, onClick) {
    const btn = document.createElement('div');
    btn.className = 'quick-btn';
    btn.innerHTML = `
        <div class="qb-icon">${icon}</div>
        <div class="qb-title">${title}</div>
        <div class="qb-sub">${subtitle}</div>
    `;
    btn.onclick = onClick;
    return btn;
}

// Update stat card value with animation
function updateStatValue(cardElement, newValue, animate = true) {
    const valueEl = cardElement.querySelector('.stat-value');
    if (!valueEl) return;

    if (animate) {
        const oldValue = parseFloat(valueEl.textContent.replace(/[^0-9.-]/g, ''));
        const newVal = parseFloat(newValue.toString().replace(/[^0-9.-]/g, ''));
        if (!isNaN(oldValue) && !isNaN(newVal)) {
            animateNumber(valueEl, oldValue, newVal, 500);
            return;
        }
    }

    valueEl.textContent = newValue;
}

// Animate number counting
function animateNumber(element, start, end, duration) {
    const range = end - start;
    const stepTime = Math.abs(Math.floor(duration / range));
    let current = start;
    const timer = setInterval(() => {
        current += Math.sign(range);
        element.textContent = formatNumber(current);
        if (current === end) {
            clearInterval(timer);
        }
    }, stepTime);
}

function formatNumber(num) {
    if (num > 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num > 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// Create fee summary cards for student
function createFeeSummaryCards(total, paid, balance) {
    const container = document.createElement('div');
    container.className = 'stats-grid';
    container.style.gridTemplateColumns = 'repeat(3, 1fr)';

    const totalCard = createStatCard('💰', fmtCurrency(total), 'Total Fees');
    const paidCard = createStatCard('✅', fmtCurrency(paid), 'Paid');
    const balanceCard = createStatCard('⏳', fmtCurrency(balance), 'Balance');

    if (balance > 0) {
        balanceCard.querySelector('.stat-value')?.style.setProperty('color', 'var(--danger)');
    } else {
        balanceCard.querySelector('.stat-value')?.style.setProperty('color', 'var(--success)');
    }

    container.appendChild(totalCard);
    container.appendChild(paidCard);
    container.appendChild(balanceCard);

    // Add progress bar
    const pct = total > 0 ? (paid / total) * 100 : 0;
    const progressBar = document.createElement('div');
    progressBar.style.cssText = 'margin-top: 12px; background: var(--border-light); border-radius: 99px; height: 8px; overflow: hidden;';
    progressBar.innerHTML = `<div style="width: ${pct}%; height: 100%; background: var(--role-primary); border-radius: 99px;"></div>`;
    container.appendChild(progressBar);

    const pctText = document.createElement('p');
    pctText.style.cssText = 'text-align: center; margin-top: 8px; font-size: 0.8rem;';
    pctText.textContent = `${pct.toFixed(1)}% collected`;
    container.appendChild(pctText);

    return container;
}