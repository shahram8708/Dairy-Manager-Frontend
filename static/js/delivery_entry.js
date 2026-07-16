let gridData = {
    entry: null,
    dealers: [],
    products: [],
    totals: {}
};
let isSaving = false;

async function initDeliveryPage() {
    if (!App.isAdmin()) {
        window.location.href = '/dashboard';
        return;
    }
    try {
        const data = await API.get('/agencies?is_active=true');
        const sel = document.getElementById('agencySelect');
        (data.agencies || []).forEach(a => {
            sel.innerHTML += `<option value="${a.id}">${a.name} (${a.shift_label || ''})</option>`;
        });
    } catch (e) {
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

        renderGrid();
        document.getElementById('gridCard').style.display = 'block';
        document.getElementById('actionButtons').style.display = 'block';
        updateStatusBadge();
        updateButtonStates();
    } catch (e) {
        App.showToast(e.error || 'Failed to load grid', 'error');
    }
    App.hideLoading();
}

function renderGrid() {
    const { dealers, products } = gridData;
    const isFinalized = gridData.entry && gridData.entry.status === 'finalized';

    // Build header
    let headHtml = '<tr><th class="sticky-col">Dealer</th>';
    products.forEach(p => {
        headHtml += `<th class="text-center product-col" title="${p.outer_unit || 'Unit'}">${p.name}<br><small class="text-muted">${p.pack_size || ''}</small></th>`;
    });
    headHtml += '<th class="text-end total-col">Day Bill (₹)</th></tr>';
    document.getElementById('gridHead').innerHTML = headHtml;

    // Build body
    let bodyHtml = '';
    dealers.forEach((dealer, dIdx) => {
        bodyHtml += `<tr data-dealer-id="${dealer.id}">`;
        bodyHtml += `<td class="sticky-col dealer-name">${dealer.name}</td>`;

        products.forEach((product, pIdx) => {
            const item = (dealer.items || []).find(i => i.product_id === product.id);
            const qty = item ? item.quantity : '';
            const isNB = item ? item.is_non_billable : false;
            const remark = item ? (item.remark || '') : '';

            bodyHtml += `<td class="qty-cell ${isNB ? 'non-billable' : ''}">`;
            bodyHtml += `<div class="qty-wrapper">`;
            bodyHtml += `<input type="number" class="form-control form-control-sm qty-input" 
                step="0.5" min="0" value="${qty || ''}" 
                data-dealer="${dealer.id}" data-product="${product.id}" 
                data-price="${product.current_price || 0}"
                tabindex="${dIdx * products.length + pIdx + 1}"
                onchange="recalcRow(this)" oninput="recalcRow(this)"
                ${isFinalized ? 'disabled' : ''}>`;
            bodyHtml += `<div class="qty-controls">`;
            bodyHtml += `<label class="nb-toggle" title="Non-billable"><input type="checkbox" class="nb-check" data-dealer="${dealer.id}" data-product="${product.id}" ${isNB ? 'checked' : ''} onchange="toggleNonBillable(this)" ${isFinalized ? 'disabled' : ''}><span class="nb-icon">🎁</span></label>`;
            bodyHtml += `</div></div></td>`;
        });

        const dayTotal = calculateDealerTotal(dealer);
        bodyHtml += `<td class="text-end fw-bold day-total" id="total-${dealer.id}">${App.formatCurrency(dayTotal)}</td>`;
        bodyHtml += '</tr>';
    });

    document.getElementById('gridBody').innerHTML = bodyHtml || '<tr><td colspan="100" class="text-center text-muted py-4">No dealers assigned to this agency</td></tr>';

    // Build footer totals
    renderTotals();
}

function calculateDealerTotal(dealer) {
    let total = 0;
    const products = gridData.products;
    products.forEach(product => {
        const input = document.querySelector(`input.qty-input[data-dealer="${dealer.id}"][data-product="${product.id}"]`);
        const nbCheck = document.querySelector(`input.nb-check[data-dealer="${dealer.id}"][data-product="${product.id}"]`);
        if (input) {
            const qty = parseFloat(input.value) || 0;
            const price = parseFloat(input.dataset.price) || 0;
            const isNB = nbCheck ? nbCheck.checked : false;
            if (qty > 0 && !isNB) {
                total += qty * price;
            }
        }
    });
    return total;
}

function recalcRow(input) {
    const dealerId = input.dataset.dealer;
    const dealer = gridData.dealers.find(d => String(d.id) === String(dealerId));
    if (!dealer) return;

    const dayTotal = calculateDealerTotal(dealer);
    const totalEl = document.getElementById(`total-${dealerId}`);
    if (totalEl) totalEl.textContent = App.formatCurrency(dayTotal);

    renderTotals();
}

function toggleNonBillable(checkbox) {
    const cell = checkbox.closest('.qty-cell');
    if (checkbox.checked) {
        cell.classList.add('non-billable');
    } else {
        cell.classList.remove('non-billable');
    }
    const dealerId = checkbox.dataset.dealer;
    const input = document.querySelector(`input.qty-input[data-dealer="${dealerId}"][data-product="${checkbox.dataset.product}"]`);
    if (input) recalcRow(input);
}

function renderTotals() {
    const products = gridData.products;
    const dealers = gridData.dealers;

    let footHtml = '<tr class="table-dark"><td class="sticky-col fw-bold">TOTAL</td>';
    products.forEach(product => {
        let colTotal = 0;
        dealers.forEach(dealer => {
            const input = document.querySelector(`input.qty-input[data-dealer="${dealer.id}"][data-product="${product.id}"]`);
            if (input) colTotal += parseFloat(input.value) || 0;
        });
        footHtml += `<td class="text-center fw-bold">${colTotal || '-'}</td>`;
    });

    let grandTotal = 0;
    dealers.forEach(dealer => {
        grandTotal += calculateDealerTotal(dealer);
    });
    footHtml += `<td class="text-end fw-bold">${App.formatCurrency(grandTotal)}</td></tr>`;
    document.getElementById('gridFoot').innerHTML = footHtml;
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
    document.getElementById('saveBtn').style.display = isFinalized ? 'none' : 'inline-block';
    document.getElementById('finalizeBtn').style.display = (gridData.entry && !isFinalized) ? 'inline-block' : 'none';
    document.getElementById('unlockBtn').style.display = isFinalized ? 'inline-block' : 'none';
}

async function saveEntry() {
    if (isSaving) return;
    isSaving = true;

    const agencyId = document.getElementById('agencySelect').value;
    const date = document.getElementById('deliveryDate').value;
    const lineItems = [];

    gridData.dealers.forEach(dealer => {
        gridData.products.forEach(product => {
            const input = document.querySelector(`input.qty-input[data-dealer="${dealer.id}"][data-product="${product.id}"]`);
            const nbCheck = document.querySelector(`input.nb-check[data-dealer="${dealer.id}"][data-product="${product.id}"]`);
            const qty = input ? parseFloat(input.value) || 0 : 0;
            if (qty > 0) {
                lineItems.push({
                    dealer_id: dealer.id,
                    product_id: product.id,
                    quantity: qty,
                    is_non_billable: nbCheck ? nbCheck.checked : false,
                    remark: ''
                });
            }
        });
    });

    const payload = {
        agency_id: parseInt(agencyId),
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
    } catch (e) {
        App.showToast(e.error || 'Failed to save', 'error');
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
        } catch (e) {
            App.showToast(e.error || 'Failed', 'error');
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
        } catch (e) {
            App.showToast(e.error || 'Failed', 'error');
        }
    });
}

document.addEventListener('DOMContentLoaded', initDeliveryPage);
