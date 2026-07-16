// Common report utilities

const Reports = (() => {
    function getDateRange() {
        const from = document.getElementById('fromDate');
        const to = document.getElementById('toDate');
        return {
            from: from ? from.value : null,
            to: to ? to.value : null
        };
    }

    function validateDateRange() {
        const { from, to } = getDateRange();
        if (!from || !to) {
            App.showToast('Please select both from and to dates', 'error');
            return false;
        }
        if (new Date(from) > new Date(to)) {
            App.showToast('From date must be before to date', 'error');
            return false;
        }
        return true;
    }

    function formatReportDate(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    }

    async function exportToFormat(reportType, format, extraParams = {}) {
        let url = `/reports/export/${reportType}?format=${format}`;
        Object.entries(extraParams).forEach(([key, val]) => {
            if (val !== null && val !== undefined && val !== '') {
                url += `&${key}=${encodeURIComponent(val)}`;
            }
        });

        const extensions = { pdf: 'pdf', excel: 'xlsx' };
        const filename = `${reportType}_${App.todayISO()}.${extensions[format] || format}`;

        try {
            await API.download(url, filename);
            App.showToast(`${format.toUpperCase()} downloaded`, 'success');
        } catch (e) {
            App.showToast(`Export failed: ${e.message || 'Unknown error'}`, 'error');
        }
    }

    function printReport() {
        window.print();
    }

    function buildExportButtons(containerId, reportType, getParams) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <button class="btn btn-outline-danger btn-sm me-1" onclick="Reports.exportToFormat('${reportType}', 'pdf', (${getParams.toString()})())">
                <i class="bi bi-file-pdf me-1"></i>PDF
            </button>
            <button class="btn btn-outline-success btn-sm me-1" onclick="Reports.exportToFormat('${reportType}', 'excel', (${getParams.toString()})())">
                <i class="bi bi-file-excel me-1"></i>Excel
            </button>
            <button class="btn btn-outline-secondary btn-sm" onclick="window.print()">
                <i class="bi bi-printer me-1"></i>Print
            </button>
        `;
    }

    return {
        getDateRange,
        validateDateRange,
        formatReportDate,
        exportToFormat,
        printReport,
        buildExportButtons
    };
})();
