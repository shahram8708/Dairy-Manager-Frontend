/**
 * API Client Module - Dairy Distribution Manager
 *
 * Core HTTP client with JWT auth, health-check polling with backoff,
 * automatic token refresh, and retry logic for cold-start wake-up.
 */
const API = (() => {
    let BASE_URL = '';
    let isBackendAwake = false;
    let healthCheckTimeout = null;
    let healthCheckDelay = 1000; // start at 1 second
    const MAX_HEALTH_DELAY = 15000; // max 15 seconds between checks
    const MAX_RETRIES = 5;

    /**
     * Initialize the API client.
     * Reads the backend base URL from a hidden DOM element.
     */
    function init() {
        const el = document.getElementById('api-base-url');
        BASE_URL = el ? el.textContent.trim() : 'http://127.0.0.1:5000/api/v1';
        // Remove trailing slash if any
        BASE_URL = BASE_URL.replace(/\/+$/, '');
        startHealthCheck();
    }

    // ─── Token Management ──────────────────────────────────────

    function getToken() {
        return localStorage.getItem('access_token');
    }

    function setTokens(access, refresh) {
        localStorage.setItem('access_token', access);
        if (refresh) localStorage.setItem('refresh_token', refresh);
    }

    function clearTokens() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    }

    /**
     * Decode the JWT payload (without verification).
     * Returns the parsed payload object or null.
     */
    function getUserFromToken() {
        const token = getToken();
        if (!token) return null;
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            // Base64url → Base64
            let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            // Pad if necessary
            while (payload.length % 4) payload += '=';
            const decoded = atob(payload);
            return JSON.parse(decoded);
        } catch (e) {
            return null;
        }
    }

    // ─── Health Check with Exponential Backoff ─────────────────

    function startHealthCheck() {
        if (isBackendAwake) return;
        updateConnectionStatus('connecting');
        checkHealth();
    }

    async function checkHealth() {
        if (isBackendAwake) return;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const resp = await fetch(`${BASE_URL}/health`, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (resp.ok) {
                isBackendAwake = true;
                healthCheckDelay = 1000; // reset delay
                updateConnectionStatus('connected');
                if (healthCheckTimeout) {
                    clearTimeout(healthCheckTimeout);
                    healthCheckTimeout = null;
                }
                return;
            }
        } catch (e) {
            // Backend still waking up - schedule next attempt with backoff
        }
        healthCheckDelay = Math.min(healthCheckDelay * 1.5, MAX_HEALTH_DELAY);
        healthCheckTimeout = setTimeout(checkHealth, healthCheckDelay);
    }

    /**
     * Update the connection status badge in the UI.
     */
    function updateConnectionStatus(status) {
        const el = document.getElementById('connection-status');
        if (!el) return;
        if (status === 'connected') {
            el.className = 'badge bg-success connection-badge';
            el.innerHTML = '<i class="bi bi-wifi me-1"></i>Connected';
            // Auto-hide after 3 seconds
            setTimeout(() => {
                el.style.opacity = '0';
                setTimeout(() => { el.style.display = 'none'; }, 300);
            }, 3000);
        } else {
            el.className = 'badge bg-warning text-dark connection-badge';
            el.innerHTML = '<i class="bi bi-wifi-off me-1"></i>Connecting...';
            el.style.display = 'inline-block';
            el.style.opacity = '1';
        }
    }

    // ─── Core Request Function ─────────────────────────────────

    /**
     * Make an HTTP request to the backend API.
     *
     * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
     * @param {string} endpoint - API endpoint (e.g. '/dealers')
     * @param {object|null} data - Request body for POST/PUT
     * @param {number} retries - Remaining retry attempts
     * @returns {Promise<object>} Parsed JSON response
     */
    const REFRESH_ENDPOINT = '/auth/refresh';

    async function request(method, endpoint, data = null, retries = MAX_RETRIES) {
        const url = `${BASE_URL}${endpoint}`;
        const headers = { 'Content-Type': 'application/json' };
        const token = getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const options = { method, headers };
        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        try {
            const resp = await fetch(url, options);

            // Handle 401 - try token refresh
            if (resp.status === 401 && endpoint !== REFRESH_ENDPOINT) {
                const refreshed = await refreshToken();
                if (refreshed) {
                    return request(method, endpoint, data, retries);
                }
                clearTokens();
                window.location.href = '/login';
                return null;
            }

            // If we get any response, backend is awake
            if (!isBackendAwake) {
                isBackendAwake = true;
                updateConnectionStatus('connected');
            }

            const json = await resp.json();
            if (!resp.ok) {
                // Throw structured API error
                throw { status: resp.status, ...json };
            }
            return json;

        } catch (err) {
            // If it's a structured API error, don't retry
            if (err.status) throw err;

            // Network error - backend may be waking up
            if (retries > 0) {
                const waitMs = Math.min(2000 * (MAX_RETRIES - retries + 1), 8000);
                await new Promise(resolve => setTimeout(resolve, waitMs));
                return request(method, endpoint, data, retries - 1);
            }

            throw { error: 'Unable to connect to server. Please check your connection and try again.' };
        }
    }

    /**
     * Attempt to refresh the access token using the refresh token.
     * @returns {Promise<boolean>} True if refresh succeeded
     */
    async function refreshToken() {
        const refresh = localStorage.getItem('refresh_token');
        if (!refresh) return false;

        try {
            const resp = await fetch(`${BASE_URL}${REFRESH_ENDPOINT}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${refresh}`
                }
            });
            const data = await resp.json().catch(() => null);
            if (resp.ok && data && data.access_token) {
                localStorage.setItem('access_token', data.access_token);
                return true;
            }
            if (resp.status === 401) {
                clearTokens();
            }
        } catch (e) {
            // Refresh failed silently
        }
        return false;
    }

    // ─── Convenience HTTP Methods ──────────────────────────────

    const get = (endpoint) => request('GET', endpoint);
    const post = (endpoint, data) => request('POST', endpoint, data);
    const put = (endpoint, data) => request('PUT', endpoint, data);
    const patch = (endpoint, data) => request('PATCH', endpoint, data);
    const del = (endpoint) => request('DELETE', endpoint);

    // ─── File Download ─────────────────────────────────────────

    /**
     * Download a file from the API (e.g. CSV/PDF exports).
     *
     * @param {string} endpoint - API endpoint for the file
     * @param {string} filename - Suggested download filename
     */
    async function download(endpoint, filename) {
        const url = `${BASE_URL}${endpoint}`;
        const headers = {};
        const token = getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const resp = await fetch(url, { headers });
            if (!resp.ok) {
                const errorData = await resp.json().catch(() => ({}));
                throw { status: resp.status, error: errorData.error || 'Download failed' };
            }
            const blob = await resp.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        } catch (err) {
            if (err.status) throw err;
            throw { error: 'Download failed. Please try again.' };
        }
    }

    // ─── Public API ────────────────────────────────────────────

    return {
        init,
        get,
        post,
        put,
        patch,
        del,
        download,
        getToken,
        setTokens,
        clearTokens,
        getUserFromToken,
        refreshToken,
        isAwake: () => isBackendAwake
    };
})();

// Auto-initialize on DOM ready and support already-loaded pages
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => API.init());
} else {
    API.init();
}
