/**
 * App Utilities Module - Dairy Distribution Manager
 *
 * Common helper functions: toasts, currency formatting, date helpers,
 * loading overlay, confirm dialogs, auth checks, navigation, and pagination.
 */
const App = (() => {

    // ─── Toast Notifications ───────────────────────────────────

    /**
     * Show a toast notification.
     *
     * @param {string} message - Message text
     * @param {string} type - 'success' | 'error' | 'info' | 'warning'
     */
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: 'bi-check-circle-fill',
            error: 'bi-x-circle-fill',
            info: 'bi-info-circle-fill',
            warning: 'bi-exclamation-triangle-fill'
        };
        const colors = {
            success: '#A2DE96',
            error: '#E53E3E',
            info: '#4FC0D0',
            warning: '#ECC94B'
        };

        const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

        const html = `
        <div id="${id}" class="toast show" role="alert" aria-live="assertive" style="border-left: 4px solid ${colors[type] || colors.info};">
            <div class="toast-body d-flex align-items-center">
                <i class="bi ${icons[type] || icons.info} me-2 flex-shrink-0" style="color:${colors[type] || colors.info};font-size:1.2rem;"></i>
                <span class="flex-grow-1">${escapeHtml(message)}</span>
                <button type="button" class="btn-close ms-3 flex-shrink-0" onclick="this.closest('.toast').remove()" aria-label="Close"></button>
            </div>
        </div>`;

        container.insertAdjacentHTML('beforeend', html);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) {
                el.style.opacity = '0';
                el.style.transform = 'translateX(100%)';
                el.style.transition = 'all 0.3s ease';
                setTimeout(() => el.remove(), 300);
            }
        }, 5000);
    }

    /**
     * Escape HTML entities to prevent XSS in toast messages.
     */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ─── Currency Formatting (Indian Number System) ────────────

    /**
     * Format a number as Indian Rupee currency.
     * Uses the Indian grouping: last 3 digits, then groups of 2.
     *
     * @param {number|string|null} amount - The amount to format
     * @returns {string} Formatted string like ₹1,23,456.78
     */
    function formatCurrency(amount) {
        if (amount === null || amount === undefined || amount === '') return '₹0.00';
        const num = parseFloat(amount);
        if (isNaN(num)) return '₹0.00';

        const parts = Math.abs(num).toFixed(2).split('.');
        let intPart = parts[0];
        const decPart = parts[1];
        const isNeg = num < 0;

        let result = '';
        if (intPart.length > 3) {
            result = intPart.substring(intPart.length - 3);
            intPart = intPart.substring(0, intPart.length - 3);
            while (intPart.length > 2) {
                result = intPart.substring(intPart.length - 2) + ',' + result;
                intPart = intPart.substring(0, intPart.length - 2);
            }
            result = intPart + ',' + result;
        } else {
            result = intPart;
        }

        return (isNeg ? '-' : '') + '₹' + result + '.' + decPart;
    }

    /**
     * Format a currency value with color coding.
     * Returns an HTML string with appropriate CSS class.
     */
    function formatCurrencyHtml(amount) {
        const formatted = formatCurrency(amount);
        const num = parseFloat(amount) || 0;
        let cls = 'currency-zero';
        if (num > 0) cls = 'currency-positive';
        else if (num < 0) cls = 'currency-negative';
        return `<span class="currency ${cls}">${formatted}</span>`;
    }

    // ─── Date Formatting ───────────────────────────────────────

    /**
     * Format a date string to DD/MM/YYYY.
     *
     * @param {string} dateStr - ISO date string or similar
     * @returns {string} Formatted date
     */
    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }

    /**
     * Format a date with time: DD/MM/YYYY HH:MM.
     */
    function formatDateTime(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${mins}`;
    }

    /**
     * Get today's date in YYYY-MM-DD format (for input[type=date]).
     */
    function todayISO() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Get a date in YYYY-MM-DD format.
     */
    function toISO(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toISOString().split('T')[0];
    }

    // ─── Loading Overlay ───────────────────────────────────────

    function showLoading() {
        const el = document.getElementById('loading-overlay');
        if (el) {
            el.style.display = 'flex';
            el.style.opacity = '1';
        }
    }

    function hideLoading() {
        const el = document.getElementById('loading-overlay');
        if (el) {
            el.style.opacity = '0';
            setTimeout(() => { el.style.display = 'none'; }, 200);
        }
    }

    // ─── Confirm Dialog ────────────────────────────────────────

    /**
     * Show a confirmation modal.
     *
     * @param {string} message - Confirmation message
     * @param {Function} onConfirm - Callback when user confirms
     */
    function confirm(message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-message');
        const btnEl = document.getElementById('confirm-btn');
        if (!modal || !msgEl || !btnEl) {
            // Fallback to native confirm
            if (window.confirm(message)) onConfirm();
            return;
        }
        msgEl.textContent = message;
        const bsModal = new bootstrap.Modal(modal);

        // Remove any previous event handlers
        const newBtn = btnEl.cloneNode(true);
        btnEl.parentNode.replaceChild(newBtn, btnEl);

        newBtn.addEventListener('click', () => {
            onConfirm();
            bsModal.hide();
        });

        bsModal.show();
    }

    // ─── Auth & Role Helpers ───────────────────────────────────

    /**
     * Check if the user is authenticated.
     * Redirects to /login if no token and not already on login page.
     */
    async function checkAuth() {
        await API.init();
        const token = API.getToken();
        const refresh = localStorage.getItem('refresh_token');

        if (!token && !refresh && !window.location.pathname.includes('/login')) {
            window.location.href = '/login';
            return false;
        }

        if (!token && refresh) {
            const refreshed = await API.refreshToken();
            if (refreshed) return true;
            API.clearTokens();
            window.location.href = '/login';
            return false;
        }

        if (token) {
            const payload = API.getUserFromToken();
            const isExpired = !payload || (payload.exp && payload.exp * 1000 < Date.now());
            if (isExpired) {
                const refreshed = await API.refreshToken();
                if (!refreshed) {
                    API.clearTokens();
                    window.location.href = '/login';
                    return false;
                }
                return true;
            }

            try {
                await API.get('/auth/me');
                return true;
            } catch (err) {
                if (refresh) {
                    const refreshed = await API.refreshToken();
                    if (refreshed) {
                        try {
                            await API.get('/auth/me');
                            return true;
                        } catch (_e) {
                            // fall through
                        }
                    }
                }
                API.clearTokens();
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = '/login';
                }
                return false;
            }
        }
        return true;
    }

    /**
     * Get the current user's role from the JWT.
     */
    function getUserRole() {
        const payload = API.getUserFromToken();
        return payload ? payload.role : null;
    }

    /**
     * Check if the current user is an admin.
     */
    function isAdmin() {
        return getUserRole() === 'admin';
    }

    // ─── Navigation Setup ──────────────────────────────────────

    /**
     * Set up the sidebar navigation based on user role.
     * Hides menu items the user doesn't have access to.
     * Sets the active state on the current page's nav item.
     * Loads user info from the API.
     */
    function setupNav() {
        const role = getUserRole();
        if (!role) return;

        // Show/hide nav items based on role
        document.querySelectorAll('[data-role]').forEach(el => {
            const allowed = el.getAttribute('data-role').split(',').map(r => r.trim());
            if (allowed.includes(role)) {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });

        // Set active nav link
        const path = window.location.pathname;
        document.querySelectorAll('.sidebar-menu .nav-link').forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            if (href && href !== '#') {
                // Exact match or prefix match for sub-pages
                if (path === href || (href !== '/dashboard' && path.startsWith(href))) {
                    link.classList.add('active');
                }
            }
        });

        // Load user info
        const userDisplayName = document.getElementById('user-display-name');
        const userRoleDisplay = document.getElementById('user-role-display');
        const userMenuName = document.getElementById('user-menu-name');
        const userMenuRole = document.getElementById('user-menu-role');

        // Set defaults from token
        const payload = API.getUserFromToken();
        if (payload) {
            const name = payload.full_name || payload.username || payload.sub || 'User';
            const roleLabel = role === 'admin' ? 'Administrator' : 'Collector';
            if (userDisplayName) userDisplayName.textContent = name;
            if (userRoleDisplay) userRoleDisplay.textContent = roleLabel;
            if (userMenuName) userMenuName.textContent = name;
            if (userMenuRole) userMenuRole.textContent = roleLabel;
        }

        // Fetch fresh user info from API (non-blocking)
        API.get('/auth/me').then(data => {
            if (data && data.user) {
                const name = data.user.full_name || data.user.username || 'User';
                const roleLabel = data.user.role === 'admin' ? 'Administrator' : 'Collector';
                if (userDisplayName) userDisplayName.textContent = name;
                if (userRoleDisplay) userRoleDisplay.textContent = roleLabel;
                if (userMenuName) userMenuName.textContent = name;
                if (userMenuRole) userMenuRole.textContent = roleLabel;

                // Update business name if available
                if (data.business_name) {
                    const brandEls = document.querySelectorAll('.sidebar-brand-text');
                    brandEls.forEach(el => el.textContent = data.business_name);
                }
            }
        }).catch(() => {
            // Silently fail - we already have token-based defaults
        });
    }

    // ─── Logout ────────────────────────────────────────────────

    /**
     * Log the user out. Calls the logout API endpoint,
     * clears tokens, and redirects to login.
     */
    function logout() {
        API.post('/auth/logout').catch(() => {
            // Ignore errors - we're logging out regardless
        });
        API.clearTokens();
        window.location.href = '/login';
    }

    // ─── Utility Helpers ───────────────────────────────────────

    /**
     * Debounce a function call.
     *
     * @param {Function} fn - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(fn, delay = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    /**
     * Throttle a function call.
     *
     * @param {Function} fn - Function to throttle
     * @param {number} limit - Minimum interval in milliseconds
     * @returns {Function} Throttled function
     */
    function throttle(fn, limit = 200) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                fn(...args);
                inThrottle = true;
                setTimeout(() => { inThrottle = false; }, limit);
            }
        };
    }

    // ─── Pagination Helper ─────────────────────────────────────

    /**
     * Render pagination controls inside a container.
     *
     * @param {string} containerId - DOM id of the pagination container
     * @param {number} currentPage - Current page number (1-indexed)
     * @param {number} totalPages - Total number of pages
     * @param {Function} onPageChange - Callback(pageNumber)
     */
    function renderPagination(containerId, currentPage, totalPages, onPageChange) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '<nav aria-label="Page navigation"><ul class="pagination pagination-sm justify-content-center mb-0">';

        // Previous
        html += `<li class="page-item ${currentPage <= 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">&laquo;</a></li>`;

        // Page numbers - show window of 5 around current
        const start = Math.max(1, currentPage - 2);
        const end = Math.min(totalPages, currentPage + 2);

        if (start > 1) {
            html += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
            if (start > 2) html += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
        }

        for (let i = start; i <= end; i++) {
            html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
        }

        if (end < totalPages) {
            if (end < totalPages - 1) html += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
            html += `<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a></li>`;
        }

        // Next
        html += `<li class="page-item ${currentPage >= totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">&raquo;</a></li>`;

        html += '</ul></nav>';
        container.innerHTML = html;

        // Attach click handlers
        container.querySelectorAll('.page-link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(e.currentTarget.dataset.page);
                if (page >= 1 && page <= totalPages && page !== currentPage) {
                    onPageChange(page);
                }
            });
        });
    }

    // ─── Table Helper ──────────────────────────────────────────

    /**
     * Show an empty state row in a table body.
     */
    function showEmptyState(tbodyId, colspan, message = 'No data found.', icon = 'bi-inbox') {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        tbody.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="text-center text-muted py-5">
                    <i class="bi ${icon} d-block mb-2" style="font-size:2rem;opacity:0.4;"></i>
                    ${message}
                </td>
            </tr>`;
    }

    /**
     * Show a loading state row in a table body.
     */
    function showTableLoading(tbodyId, colspan) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        tbody.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="text-center text-muted py-4">
                    <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                    Loading...
                </td>
            </tr>`;
    }

    // ─── Query String Helper ───────────────────────────────────

    /**
     * Build a query string from an object, omitting null/undefined/empty values.
     */
    function buildQuery(params) {
        const filtered = Object.entries(params)
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
        return filtered.length > 0 ? '?' + filtered.join('&') : '';
    }

    // ─── Initialization ────────────────────────────────────────

    async function init() {
        if (window.location.pathname.includes('/login') || window.location.pathname === '/') {
            return;
        }
        await API.init();
        if (await checkAuth()) {
            setupNav();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ─── Public API ────────────────────────────────────────────

    return {
        showToast,
        formatCurrency,
        formatCurrencyHtml,
        formatDate,
        formatDateTime,
        todayISO,
        toISO,
        showLoading,
        hideLoading,
        confirm,
        checkAuth,
        getUserRole,
        isAdmin,
        setupNav,
        logout,
        debounce,
        throttle,
        renderPagination,
        showEmptyState,
        showTableLoading,
        buildQuery,
        escapeHtml
    };
})();
