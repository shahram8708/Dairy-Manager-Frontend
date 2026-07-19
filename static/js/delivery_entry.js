let gridData = {
    entry: null,
    dealers: [],
    products: [],
    totals: {},
    cellLookup: new Map(),
    cellState: new Map(),
    productTotals: new Map(),
    dealerBills: new Map(),
    grandTotal: 0
};
let isSaving = false;
let gridEventsBound = false;
let responsiveResizeTimer = null;
let currentViewMode = '';

const mobileCardMedia = window.matchMedia('(max-width: 575.98px)');
const mobileActionMedia = window.matchMedia('(max-width: 767.98px)');

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function roundQuantity(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function roundAmount(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeQuantity(value) {
    const num = parseFloat(value);
    return Number.isFinite(num) && num > 0 ? roundQuantity(num) : 0;
}

function formatQuantity(value) {
    const num = roundQuantity(value);
    return Number.isFinite(num) ? num.toFixed(2).replace(/\.00$/, '').replace(/(\.\d*[1-9])0$/, '$1') : '';
}

function formatInputQuantity(value) {
    const num = normalizeQuantity(value);
    return num > 0 ? formatQuantity(num) : '';
}

function formatQuantityDisplay(value) {
    const num = roundQuantity(value);
    return num > 0 ? formatQuantity(num) : '-';
}

function getCellKey(productId, dealerId) {
    return `${productId}:${dealerId}`;
}

function getCellInput(rowIndex, colIndex) {
    return document.querySelector(`.qty-input[data-row="${rowIndex}"][data-col="${colIndex}"]`);
}

function getCellState(productId, dealerId) {
    return gridData.cellState.get(getCellKey(productId, dealerId));
}

function buildGridState() {
    gridData.cellLookup = new Map();
    gridData.cellState = new Map();
    gridData.productTotals = new Map(gridData.products.map(product => [String(product.id), 0]));
    gridData.dealerBills = new Map(gridData.dealers.map(dealer => [String(dealer.id), 0]));
    gridData.grandTotal = 0;

    gridData.dealers.forEach(dealer => {
        (dealer.items || []).forEach(item => {
            gridData.cellLookup.set(getCellKey(item.product_id, dealer.id), item);
        });
    });

    gridData.products.forEach(product => {
        gridData.dealers.forEach(dealer => {
            const key = getCellKey(product.id, dealer.id);
            const item = gridData.cellLookup.get(key) || {};
            const quantity = normalizeQuantity(item.quantity);
            const unitPrice = roundAmount(item.unit_price ?? product.current_price ?? 0);
            const isNonBillable = Boolean(item.is_non_billable);
            const state = {
                productId: String(product.id),
                dealerId: String(dealer.id),
                quantity,
                unitPrice,
                isNonBillable
            };
            gridData.cellState.set(key, state);

            gridData.productTotals.set(state.productId, roundQuantity(gridData.productTotals.get(state.productId) + quantity));
            if (!isNonBillable && quantity > 0) {
                const amount = roundAmount(quantity * unitPrice);
                gridData.dealerBills.set(state.dealerId, roundAmount(gridData.dealerBills.get(state.dealerId) + amount));
                gridData.grandTotal = roundAmount(gridData.grandTotal + amount);
            }
        });
    });
}

function recalculateSummaries() {
    const productTotals = new Map(gridData.products.map(product => [String(product.id), 0]));
    const dealerBills = new Map(gridData.dealers.map(dealer => [String(dealer.id), 0]));
    let grandTotal = 0;

    gridData.cellState.forEach(state => {
        const quantity = normalizeQuantity(state.quantity);
        const productKey = String(state.productId);
        const dealerKey = String(state.dealerId);
        const billableAmount = state.isNonBillable ? 0 : roundAmount(quantity * state.unitPrice);

        productTotals.set(productKey, roundQuantity((productTotals.get(productKey) || 0) + quantity));
        dealerBills.set(dealerKey, roundAmount((dealerBills.get(dealerKey) || 0) + billableAmount));
        grandTotal = roundAmount(grandTotal + billableAmount);
    });

    gridData.productTotals = productTotals;
    gridData.dealerBills = dealerBills;
    gridData.grandTotal = grandTotal;

    gridData.products.forEach(product => {
        const productEl = document.getElementById(`product-total-${product.id}`);
        if (productEl) productEl.textContent = formatQuantityDisplay(productTotals.get(String(product.id)) || 0);
    });

    gridData.dealers.forEach(dealer => {
        const dealerEl = document.getElementById(`dealer-bill-${dealer.id}`);
        if (dealerEl) dealerEl.textContent = App.formatCurrency(dealerBills.get(String(dealer.id)) || 0);
    });

    const grandTotalEl = document.getElementById('grandTotalCell');
    if (grandTotalEl) grandTotalEl.textContent = App.formatCurrency(grandTotal);
}

function applyCellChange(target, commitValue) {
    const productId = target.dataset.productId;
    const dealerId = target.dataset.dealerId;
    const state = getCellState(productId, dealerId);
    if (!state) return;

    const nextQuantity = normalizeQuantity(target.value);
    const prevQuantity = state.quantity;
    if (nextQuantity === prevQuantity && !commitValue) return;

    state.quantity = nextQuantity;
    if (commitValue) target.value = formatInputQuantity(nextQuantity);

    recalculateSummaries();
}

function applyBillableToggle(target) {
    const productId = target.dataset.productId;
    const dealerId = target.dataset.dealerId;
    const state = getCellState(productId, dealerId);
    if (!state) return;

    state.isNonBillable = target.checked;

    const cell = target.closest('.qty-cell');
    if (cell) cell.classList.toggle('non-billable', state.isNonBillable);

    recalculateSummaries();
}

function handleGridEvent(event) {
    const target = event.target;
    if (target.classList.contains('qty-input')) {
        applyCellChange(target, event.type === 'change');
        return;
    }
    if (target.classList.contains('nb-check')) {
        applyBillableToggle(target);
    }
}

function handleGridKeydown(event) {
    const target = event.target;
    if (!target.classList.contains('qty-input')) return;

    const rowIndex = parseInt(target.dataset.row, 10);
    const colIndex = parseInt(target.dataset.col, 10);
    const maxRow = gridData.products.length - 1;
    const maxCol = gridData.dealers.length - 1;
    let nextRow = rowIndex;
    let nextCol = colIndex;

    if (event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey)) {
        if (colIndex > 0) {
            nextCol -= 1;
        } else if (rowIndex > 0) {
            nextRow -= 1;
            nextCol = maxCol;
        } else {
            return;
        }
    } else if (event.key === 'ArrowRight' || event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey)) {
        if (colIndex < maxCol) {
            nextCol += 1;
        } else if (rowIndex < maxRow) {
            nextRow += 1;
            nextCol = 0;
        } else {
            return;
        }
    } else if (event.key === 'ArrowUp') {
        if (rowIndex === 0) return;
        nextRow -= 1;
    } else if (event.key === 'ArrowDown') {
        if (rowIndex === maxRow) return;
        nextRow += 1;
    } else {
        return;
    }

    const next = getCellInput(nextRow, nextCol);
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.select();
}

function bindGridEvents() {
    const responsiveArea = document.getElementById('deliveryResponsiveArea');
    if (!responsiveArea || gridEventsBound) return;
    gridEventsBound = true;
    responsiveArea.addEventListener('input', handleGridEvent);
    responsiveArea.addEventListener('change', handleGridEvent);
    responsiveArea.addEventListener('keydown', handleGridKeydown);
}

function bindResponsiveListeners() {
    const onChange = () => {
        if (!gridData.products.length || !gridData.dealers.length) {
            updateButtonStates();
            return;
        }
        renderResponsiveView();
        updateButtonStates();
    };

    if (mobileCardMedia.addEventListener) {
        mobileCardMedia.addEventListener('change', onChange);
        mobileActionMedia.addEventListener('change', onChange);
    } else {
        mobileCardMedia.addListener(onChange);
        mobileActionMedia.addListener(onChange);
    }

    window.addEventListener('resize', () => {
        clearTimeout(responsiveResizeTimer);
        responsiveResizeTimer = setTimeout(() => {
            if (gridData.products.length && gridData.dealers.length) {
                renderResponsiveView();
                updateButtonStates();
            }
        }, 120);
    });
}

async function initDeliveryPage() {
    if (!App.isAdmin()) {
        window.location.href = '/dashboard';
        return;
    }

    bindGridEvents();
    bindResponsiveListeners();

    try {
        const data = await API.get('/agencies?is_active=true');
        const sel = document.getElementById('agencySelect');
        (data.agencies || []).forEach(agency => {
            sel.insertAdjacentHTML('beforeend', `<option value="${agency.id}">${escapeHtml(agency.name)} (${escapeHtml(agency.shift_label || '')})</option>`);
        });
    } catch (error) {
        App.showToast('Failed to load agencies', 'error');
    }

    document.getElementById('deliveryDate').value = App.todayISO();
}

async function loadGrid() {
    const agencyId = document.getElementById('agencySelect').value;
    const date = document.getElementById('deliveryDate').value;
    if (!agencyId || !date) {
        App.showToast('Select agency and date', 'error');
        return;
    }

    App.showLoading();
    try {
        const data = await API.get(`/deliveries?agency_id=${agencyId}&date=${date}`);
        gridData.entry = data.entry;
        gridData.dealers = data.dealers || [];
        gridData.products = data.products || [];
        gridData.totals = data.totals || {};

        buildGridState();
        renderResponsiveView(true);
        recalculateSummaries();

        document.getElementById('gridCard').style.display = 'block';
        document.getElementById('actionButtons').style.display = 'block';
        updateStatusBadge();
        updateButtonStates();
    } catch (error) {
        App.showToast(error.error || 'Failed to load grid', 'error');
    }
    App.hideLoading();
}

function renderGrid() {
    const dealers = gridData.dealers;
    const products = gridData.products;
    const isFinalized = gridData.entry && gridData.entry.status === 'finalized';
    const gridHead = document.getElementById('gridHead');
    const gridBody = document.getElementById('gridBody');
    const gridFoot = document.getElementById('gridFoot');

    if (!dealers.length || !products.length) {
        gridHead.innerHTML = '<tr><th class="sticky-col">Product</th><th class="text-center">No data</th><th class="sticky-total-col">Total Qty</th></tr>';
        gridBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-5">No products or dealers available for this agency</td></tr>';
        gridFoot.innerHTML = '';
        return;
    }

    let headHtml = '<tr><th class="sticky-col sticky-top-left">Product</th>';
    dealers.forEach(dealer => {
        headHtml += `<th class="text-center dealer-header">${escapeHtml(dealer.name)}</th>`;
    });
    headHtml += '<th class="text-end sticky-total-col">Total Qty</th></tr>';
    gridHead.innerHTML = headHtml;

    let bodyHtml = '';
    products.forEach((product, rowIndex) => {
        bodyHtml += `<tr data-product-id="${product.id}">`;
        bodyHtml += `<td class="sticky-col product-name">${escapeHtml(product.name)}<small>${escapeHtml(product.pack_size || '')}</small></td>`;

        dealers.forEach((dealer, colIndex) => {
            const state = getCellState(product.id, dealer.id) || {
                productId: String(product.id),
                dealerId: String(dealer.id),
                quantity: 0,
                unitPrice: roundAmount(product.current_price || 0),
                isNonBillable: false
            };
            const inputValue = formatInputQuantity(state.quantity);
            const checked = state.isNonBillable ? 'checked' : '';
            const disabled = isFinalized ? 'disabled' : '';
            const cellClass = state.isNonBillable ? 'qty-cell non-billable' : 'qty-cell';

            bodyHtml += `<td class="${cellClass}">`;
            bodyHtml += '<div class="qty-wrapper">';
            bodyHtml += `<input type="number" class="form-control form-control-sm qty-input" step="0.5" min="0" inputmode="decimal" value="${inputValue}" data-row="${rowIndex}" data-col="${colIndex}" data-product-id="${product.id}" data-dealer-id="${dealer.id}" data-price="${state.unitPrice}" ${disabled}>`;
            bodyHtml += `<label class="nb-toggle" title="Non-billable"><input type="checkbox" class="nb-check" data-product-id="${product.id}" data-dealer-id="${dealer.id}" ${checked} ${disabled}><span class="nb-icon">Non-billable</span></label>`;
            bodyHtml += '</div></td>';
        });

        bodyHtml += `<td class="text-end sticky-total-col product-total-cell" id="product-total-${product.id}">${formatQuantityDisplay(gridData.productTotals.get(String(product.id)) || 0)}</td>`;
        bodyHtml += '</tr>';
    });

    gridBody.innerHTML = bodyHtml;

    let footHtml = '<tr class="day-bill-row"><td class="sticky-col day-bill-label">Day Bill</td>';
    dealers.forEach(dealer => {
        footHtml += `<td class="text-end dealer-bill-cell" id="dealer-bill-${dealer.id}">${App.formatCurrency(gridData.dealerBills.get(String(dealer.id)) || 0)}</td>`;
    });
    footHtml += `<td class="text-end sticky-total-col grand-total-cell" id="grandTotalCell">${App.formatCurrency(gridData.grandTotal)}</td></tr>`;
    gridFoot.innerHTML = footHtml;
}

function renderMobileCards() {
    const mobileCards = document.getElementById('deliveryMobileCards');
    const gridHead = document.getElementById('gridHead');
    const gridBody = document.getElementById('gridBody');
    const gridFoot = document.getElementById('gridFoot');

    gridHead.innerHTML = '';
    gridBody.innerHTML = '';
    gridFoot.innerHTML = '';

    let html = '';
    gridData.products.forEach((product, rowIndex) => {
        html += `<section class="delivery-mobile-card" data-product-id="${product.id}">`;
        html += '<div class="delivery-mobile-card-header">';
        html += `<div class="delivery-mobile-card-title">${escapeHtml(product.name)}</div>`;
        html += `<div class="delivery-mobile-card-subtitle">${escapeHtml(product.pack_size || '')}</div>`;
        html += '</div>';
        html += '<div class="delivery-mobile-card-body">';

        gridData.dealers.forEach((dealer, colIndex) => {
            const state = getCellState(product.id, dealer.id) || {
                productId: String(product.id),
                dealerId: String(dealer.id),
                quantity: 0,
                unitPrice: roundAmount(product.current_price || 0),
                isNonBillable: false
            };
            const inputValue = formatInputQuantity(state.quantity);
            const checked = state.isNonBillable ? 'checked' : '';
            const disabled = (gridData.entry && gridData.entry.status === 'finalized') ? 'disabled' : '';
            html += `<div class="delivery-mobile-cell ${state.isNonBillable ? 'non-billable' : ''}">`;
            html += `<div class="delivery-mobile-cell-label"><span>${escapeHtml(dealer.name)}</span><small>${state.isNonBillable ? 'Non-billable' : ''}</small></div>`;
            html += `<input type="number" class="form-control delivery-mobile-input qty-input" step="0.5" min="0" inputmode="decimal" value="${inputValue}" data-row="${rowIndex}" data-col="${colIndex}" data-product-id="${product.id}" data-dealer-id="${dealer.id}" data-price="${state.unitPrice}" ${disabled}>`;
            html += `<label class="nb-toggle mt-1" title="Non-billable"><input type="checkbox" class="nb-check" data-product-id="${product.id}" data-dealer-id="${dealer.id}" ${checked} ${disabled}><span class="nb-icon">Non-billable</span></label>`;
            html += '</div>';
        });

        html += `<div class="delivery-mobile-total"><span>Total Qty</span><span id="product-total-${product.id}">${formatQuantityDisplay(gridData.productTotals.get(String(product.id)) || 0)}</span></div>`;
        html += '</div></section>';
    });

    html += '<section class="delivery-mobile-card"><div class="delivery-mobile-card-header"><div class="delivery-mobile-card-title">Day Bill Summary</div><div class="delivery-mobile-card-subtitle">Dealer-wise bill and grand total</div></div><div class="delivery-mobile-card-body">';
    gridData.dealers.forEach(dealer => {
        html += `<div class="delivery-mobile-total"><span>${escapeHtml(dealer.name)}</span><span id="dealer-bill-${dealer.id}">${App.formatCurrency(gridData.dealerBills.get(String(dealer.id)) || 0)}</span></div>`;
    });
    html += `<div class="delivery-mobile-total"><span>Grand Total</span><span class="grand-total-cell px-2 py-1 rounded-3" id="grandTotalCell">${App.formatCurrency(gridData.grandTotal)}</span></div>`;
    html += '</div></section>';

    mobileCards.innerHTML = html;
}

function renderResponsiveView(force = false) {
    const nextMode = mobileCardMedia.matches ? 'mobile' : 'desktop';
    if (!force && currentViewMode === nextMode) return;
    currentViewMode = nextMode;

    if (nextMode === 'mobile') {
        renderMobileCards();
    } else {
        renderGrid();
    }

    const swipeHint = document.getElementById('swipeHint');
    if (swipeHint) {
        swipeHint.style.display = mobileActionMedia.matches && !mobileCardMedia.matches ? 'block' : 'none';
    }
}

function updateStatusBadge() {
    const badge = document.getElementById('entryStatus');
    if (gridData.entry) {
        if (gridData.entry.status === 'finalized') {
            badge.className = 'badge bg-danger';
            badge.textContent = 'Finalized (Locked)';
        } else {
            badge.className = 'badge bg-success';
            badge.textContent = 'Open';
        }
    } else {
        badge.className = 'badge bg-info';
        badge.textContent = 'New Entry';
    }
}

function updateButtonStates() {
    const isFinalized = gridData.entry && gridData.entry.status === 'finalized';
    const mobileMode = mobileActionMedia.matches;
    const desktopButtons = document.getElementById('actionButtons');
    const mobileBar = document.getElementById('mobileActionBar');

    if (desktopButtons) desktopButtons.style.display = mobileMode ? 'none' : 'block';
    if (mobileBar) mobileBar.style.display = mobileMode ? 'flex' : 'none';

    const saveBtn = document.getElementById('saveBtn');
    const finalizeBtn = document.getElementById('finalizeBtn');
    const unlockBtn = document.getElementById('unlockBtn');
    const mobileSaveBtn = document.getElementById('mobileSaveBtn');
    const mobileFinalizeBtn = document.getElementById('mobileFinalizeBtn');
    const mobileUnlockBtn = document.getElementById('mobileUnlockBtn');

    if (saveBtn) saveBtn.style.display = isFinalized ? 'none' : 'inline-block';
    if (finalizeBtn) finalizeBtn.style.display = (gridData.entry && !isFinalized) ? 'inline-block' : 'none';
    if (unlockBtn) unlockBtn.style.display = isFinalized ? 'inline-block' : 'none';

    if (mobileSaveBtn) mobileSaveBtn.style.display = isFinalized ? 'none' : 'inline-flex';
    if (mobileFinalizeBtn) mobileFinalizeBtn.style.display = (gridData.entry && !isFinalized) ? 'inline-flex' : 'none';
    if (mobileUnlockBtn) mobileUnlockBtn.style.display = isFinalized ? 'inline-flex' : 'none';

    const swipeHint = document.getElementById('swipeHint');
    if (swipeHint) swipeHint.style.display = mobileActionMedia.matches && !mobileCardMedia.matches ? 'block' : 'none';
}

async function saveEntry() {
    if (isSaving) return;
    isSaving = true;

    const agencyId = document.getElementById('agencySelect').value;
    const date = document.getElementById('deliveryDate').value;
    const lineItems = [];

    gridData.products.forEach(product => {
        gridData.dealers.forEach(dealer => {
            const state = getCellState(product.id, dealer.id);
            if (!state || state.quantity <= 0) return;
            lineItems.push({
                dealer_id: dealer.id,
                product_id: product.id,
                quantity: state.quantity,
                is_non_billable: state.isNonBillable,
                remark: ''
            });
        });
    });

    const payload = {
        agency_id: parseInt(agencyId, 10),
        delivery_date: date,
        line_items: lineItems
    };

    App.showLoading();
    try {
        if (gridData.entry) {
            await API.put(`/deliveries/${gridData.entry.id}`, payload);
            App.showToast('Delivery entry updated successfully', 'success');
        } else {
            await API.post('/deliveries', payload);
            App.showToast('Delivery entry saved successfully', 'success');
        }
        await loadGrid();
    } catch (error) {
        App.showToast(error.error || 'Failed to save', 'error');
    }
    App.hideLoading();
    isSaving = false;
}

async function finalizeEntry() {
    if (!gridData.entry) return;
    App.confirm('Finalize this entry? Editing will be locked.', async () => {
        try {
            await API.post(`/deliveries/${gridData.entry.id}/finalize`);
            App.showToast('Entry finalized', 'success');
            await loadGrid();
        } catch (error) {
            App.showToast(error.error || 'Failed', 'error');
        }
    });
}

async function unlockEntry() {
    if (!gridData.entry) return;
    App.confirm('Unlock this entry for editing?', async () => {
        try {
            await API.post(`/deliveries/${gridData.entry.id}/unlock`);
            App.showToast('Entry unlocked', 'success');
            await loadGrid();
        } catch (error) {
            App.showToast(error.error || 'Failed', 'error');
        }
    });
}

document.addEventListener('DOMContentLoaded', initDeliveryPage);
