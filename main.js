const MONTHS = [`Jan`, `Feb`, `Mar`, `Apr`, `May`, `Jun`, `Jul`, `Aug`, `Sep`, `Oct`, `Nov`, `Dec`];
const STORAGE_KEY = 'salaryData-v1';
const VALID_PAY_TYPES = new Set(['salary', 'hourly_full_time', 'hourly_part_time']);
const DEFAULT_PAY_TYPE = 'salary';
const MAX_HOURS_PER_WEEK = 168;

let salaryData = [];
let currentViewMode = 'dollar';
let currentChart = null;
let isSharedSnapshotMode = false;
let pendingSharedData = [];
let currentTheme = 'light';

/*
const Salaries = [
    {
        startDate: '2018-11-01',
        endDate: '2019-12-01',
        salary: 35360,
    },
    {
        startDate: '2020-01-01',
        endDate: '2023-05-01',
        salary: 42536,
    },
    {
        startDate: '2020-09-01',
        endDate: '2021-01-01',
        salary: 52536,
    },
    {
        startDate: '2021-01-01',
        endDate: '2021-06-01',
        salary: 54217.15,
    },
    {
        startDate: '2021-07-01',
        endDate: '2021-12-01',
        salary: 80000,
    },
    {
        startDate: '2022-01-01',
        endDate: '2021-01-01',
        salary: 83280,
    },
    {
        startDate: '2022-07-01',
        endDate: '2022-12-01',
        salary: 93773.28,
    },
    {
        startDate: '2023-01-01',
        endDate: '2023-12-01',
        salary: 98461.94,
    },
    {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        salary: 102400.48,
    },
    {
        startDate: '2024-07-01',
        endDate: '2024-11-01',
        salary: 105472.49,
    },
    {
        startDate: '2024-12-01',
        endDate: '2025-11-01',
        salary: 109691.39,
    },
    {
        startDate: '2025-12-01',
        endDate: '2026-05-01',
        salary: 113000.39,
    },
    {
        startDate: '2026-06-01',
        endDate: '2026-08-01',
        salary: 124800.39,
    },
];
*/

const starterSalaryData = [
    { id: 'salary-1', startDate: '2018-11-01', amount: 35360 },
    { id: 'salary-2', startDate: '2020-01-01', amount: 42536 },
    { id: 'salary-3', startDate: '2020-09-01', amount: 52536 },
    { id: 'salary-4', startDate: '2021-01-01', amount: 54217.15 },
    { id: 'salary-5', startDate: '2021-07-01', amount: 80000 },
    { id: 'salary-6', startDate: '2022-01-01', amount: 83280 },
    { id: 'salary-7', startDate: '2022-07-01', amount: 93773.28 },
    { id: 'salary-8', startDate: '2023-01-01', amount: 98461.94 },
    { id: 'salary-9', startDate: '2024-01-01', amount: 102400.48 },
    { id: 'salary-10', startDate: '2024-07-01', amount: 105472.49 },
    { id: 'salary-11', startDate: '2024-12-01', amount: 109691.39 },
    { id: 'salary-12', startDate: '2025-12-01', amount: 113000.39 },
    { id: 'salary-13', startDate: '2026-06-01', amount: 124800.39 },
];

document.addEventListener('DOMContentLoaded', () => {
    currentTheme = getStoredTheme();
    applyTheme(currentTheme);
    bindAppEvents();

    const urlParams = new URLSearchParams(window.location.search);
    const shareMode = urlParams.get('shareMode');
    const urlViewMode = urlParams.get('viewMode');
    if (urlViewMode === 'normalized' || urlViewMode === 'dollar') {
        currentViewMode = urlViewMode;
    } else if (shareMode === 'anonymized') {
        currentViewMode = 'normalized';
    }

    const urlData = getUrlPayload();
    if (urlData && urlData.length > 0) {
        isSharedSnapshotMode = true;
        pendingSharedData = urlData;
        salaryData = urlData;
    } else {
        isSharedSnapshotMode = false;
        pendingSharedData = [];
        salaryData = loadFromLocalStorage();
        if (!salaryData.length) {
            salaryData = [];
        }
    }

    applyCurrentMonthLimits();
    updatePayTypeUi();
    renderAll();
});

function bindAppEvents() {
    document.querySelectorAll('[data-dismissible-card]').forEach(card => {
        card.addEventListener('click', () => {
            card.classList.add('is-dismissed');
        });

        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                card.classList.add('is-dismissed');
            }
        });

        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
    });

    document.getElementById('themeToggleButton')?.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(currentTheme);
    });

    document.querySelectorAll('input[name="salaryType"]').forEach(radio => {
        radio.addEventListener('change', updatePayTypeUi);
    });

    document.getElementById('salaryForm').addEventListener('submit', (event) => {
        if (isSharedSnapshotMode) {
            event.preventDefault();
            return;
        }

        event.preventDefault();
        const idField = document.getElementById('salaryId');
        const dateField = document.getElementById('salaryDate');
        const amountField = document.getElementById('salaryAmount');
        const salaryType = getSelectedPayType();
        const hoursField = document.getElementById('hoursPerWeek');

        if (!dateField.value || !amountField.value) {
            return;
        }

        const payload = {
            id: idField.value || createId(),
            startDate: dateField.value,
            amount: Number(amountField.value),
            payType: salaryType,
            hoursPerWeek: salaryType === 'hourly_part_time' ? Number(hoursField.value || 0) : null,
        };

        if (idField.value) {
            salaryData = salaryData.map(entry => entry.id === payload.id ? payload : entry);
        } else {
            salaryData.push(payload);
        }

        salaryData = sortSalaryData(salaryData);
        saveToLocalStorage(salaryData);
        resetSalaryForm();
        renderAll();
    });

    document.getElementById('cancelEditButton').addEventListener('click', resetSalaryForm);

    document.getElementById('toggleSalaryHistoryButton').addEventListener('click', () => {
        const panel = document.getElementById('salaryHistoryPanel');
        const isCollapsed = panel.classList.toggle('is-collapsed');
        const button = document.getElementById('toggleSalaryHistoryButton');
        button.textContent = isCollapsed ? 'Show salary history' : 'Hide salary history';
        button.setAttribute('aria-expanded', String(!isCollapsed));
    });

    document.getElementById('salaryList').addEventListener('click', (event) => {
        if (isSharedSnapshotMode) {
            return;
        }

        const button = event.target.closest('button[data-action]');
        if (!button) {
            return;
        }

        const { id, action } = button.dataset;
        if (action === 'delete') {
            salaryData = salaryData.filter(entry => entry.id !== id);
            saveToLocalStorage(salaryData);
            if (document.getElementById('salaryId').value === id) {
                resetSalaryForm();
            }
            renderAll();
        }

        if (action === 'edit') {
            const entry = salaryData.find(item => item.id === id);
            if (!entry) {
                return;
            }

            const payTypeInput = document.querySelector(`input[name="salaryType"][value="${entry.payType}"]`);
            const hoursField = document.getElementById('hoursPerWeek');
            const form = document.getElementById('salaryForm');

            document.getElementById('salaryId').value = entry.id;
            document.getElementById('salaryDate').value = entry.startDate;
            document.getElementById('salaryAmount').value = entry.amount;
            if (payTypeInput) {
                payTypeInput.checked = true;
            }
            if (hoursField) {
                hoursField.value = entry.payType === 'hourly_part_time'
                    ? String(Number(entry.hoursPerWeek || 0).toFixed(1))
                    : '20';
            }
            document.getElementById('salarySubmitButton').textContent = 'Update Salary';
            document.getElementById('cancelEditButton').classList.remove('hidden');
            form.classList.add('is-editing');
            updatePayTypeUi();
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
            form.animate([
                { boxShadow: '0 0 0 rgba(37, 99, 235, 0)' },
                { boxShadow: '0 0 0 4px rgba(37, 99, 235, 0.18)' },
                { boxShadow: '0 0 0 0 rgba(37, 99, 235, 0)' }
            ], {
                duration: 1200,
                easing: 'ease-out'
            });
        }
    });

    document.getElementById('salaryList').addEventListener('input', (event) => {
        if (isSharedSnapshotMode) {
            return;
        }

        const target = event.target;
        const { id, field } = target.dataset;
        if (!id || !field) {
            return;
        }

        const entry = salaryData.find(item => item.id === id);
        if (!entry) {
            return;
        }

        if (document.getElementById('salaryId').value !== id) {
            event.preventDefault();
            target.value = getOriginalListValue(entry, field);
            return;
        }

        if (field === 'amount') {
            entry.amount = Number(target.value);
        } else if (field === 'payType') {
            entry.payType = target.value;
            if (entry.payType !== 'hourly_part_time') {
                entry.hoursPerWeek = null;
            }
        } else if (field === 'hoursPerWeek') {
            const nextHours = Math.min(MAX_HOURS_PER_WEEK, Math.max(1, Number(target.value || 0)));
            entry.hoursPerWeek = nextHours;
            target.value = String(nextHours.toFixed(1));
        } else {
            entry[field] = target.value;
        }

        salaryData = sortSalaryData(salaryData);
        saveToLocalStorage(salaryData);
        renderAll();
    });

    document.getElementById('clearDataButton').addEventListener('click', () => {
        if (!confirmClearData()) {
            return;
        }

        localStorage.removeItem(STORAGE_KEY);
        salaryData = [];
        resetSalaryForm();
        renderAll();
    });

    document.querySelectorAll('.view-toggle button').forEach(button => {
        button.addEventListener('click', () => {
            if (isAnonymizedShareLink() && button.dataset.view === 'dollar') {
                showShareStatus('Anonymized share links stay in percentage view.');
                currentViewMode = 'normalized';
                renderViewButtons();
                renderChart();
                return;
            }

            currentViewMode = button.dataset.view;
            renderViewButtons();
            renderChart();
        });
    });

    document.getElementById('saveFromUrlButton').addEventListener('click', () => {
        saveToLocalStorage(salaryData);
        hideSavePrompt();
    });

    document.getElementById('dismissSavePromptButton').addEventListener('click', hideSavePrompt);

    document.getElementById('returnToMyDataButton').addEventListener('click', () => {
        const confirmed = window.confirm('Return to your saved data? You will need to open the shared link again if you want to view this snapshot later.');
        if (!confirmed) {
            return;
        }

        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete('salaryData');
        nextUrl.searchParams.delete('shareMode');
        nextUrl.searchParams.delete('viewMode');
        nextUrl.hash = '';
        window.location.href = nextUrl.toString();
    });

    document.getElementById('shareButton').addEventListener('click', () => {
        document.getElementById('shareModal').classList.remove('hidden');
        updateShareUi();
    });

    document.getElementById('closeShareModal').addEventListener('click', () => {
        document.getElementById('shareModal').classList.add('hidden');
    });

    document.querySelectorAll('input[name="shareMode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            updateShareUi();
        });
    });

    document.getElementById('exactShareConfirm').addEventListener('change', () => {
        updateShareUi();
    });

    document.getElementById('copyShareLinkButton').addEventListener('click', () => {
        const selectedMode = document.querySelector('input[name="shareMode"]:checked')?.value || 'anonymized';
        if (selectedMode === 'site') {
            copyShareLink('site');
            return;
        }

        copyShareLink(false);
    });

    document.getElementById('copyExactLinkButton').addEventListener('click', () => {
        copyShareLink(true);
    });
}

function confirmClearData() {
    return window.confirm('Clear all saved salary data from this browser? This cannot be undone.');
}

function createId() {
    return `salary-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getStoredTheme() {
    const savedTheme = localStorage.getItem('truewage-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
        return savedTheme;
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
    currentTheme = theme === 'dark' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', currentTheme);
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('truewage-theme', currentTheme);
    }
    const toggleButton = document.getElementById('themeToggleButton');
    if (toggleButton) {
        toggleButton.textContent = currentTheme === 'dark' ? 'Light mode' : 'Dark mode';
        toggleButton.setAttribute('aria-label', currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
}

function resetSalaryForm() {
    const form = document.getElementById('salaryForm');
    if (form) {
        form.classList.remove('is-editing');
    }
    document.getElementById('salaryForm').reset();
    document.getElementById('salaryId').value = '';
    document.querySelector('input[name="salaryType"][value="salary"]').checked = true;
    document.getElementById('salarySubmitButton').textContent = 'Add Salary';
    document.getElementById('cancelEditButton').classList.add('hidden');
    applyCurrentMonthLimits();
    updatePayTypeUi();
}

function renderAll() {
    const viewOnlyBanner = document.getElementById('viewOnlyBanner');
    const returnToMyDataButton = document.getElementById('returnToMyDataButton');
    if (viewOnlyBanner) {
        viewOnlyBanner.classList.toggle('hidden', !isSharedSnapshotMode);
    }
    if (returnToMyDataButton) {
        returnToMyDataButton.classList.toggle('hidden', !isSharedSnapshotMode);
    }

    renderSalaryList();
    renderViewButtons();
    applyReadOnlyUi();
    if (!salaryData.length) {
        renderEmptyChartState();
        renderSalaryStats();
        const subtitle = document.getElementById('salaryGraphSubtitle');
        if (subtitle) {
            subtitle.textContent = 'Add your first salary to start the chart.';
        }
        return;
    }
    renderChart();
    renderSalaryStats();
}

function renderEmptyChartState() {
    const canvas = document.getElementById('salaryGraph');
    if (!canvas) {
        return;
    }

    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }

    const context = canvas.getContext('2d');
    const chartSurface = currentTheme === 'dark' ? '#000000' : '#0f172a';
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = chartSurface;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    context.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i += 1) {
        const y = (canvas.height / gridLines) * i;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
        context.stroke();
    }

    for (let i = 0; i <= gridLines; i += 1) {
        const x = (canvas.width / gridLines) * i;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvas.height);
        context.stroke();
    }

    context.fillStyle = 'rgba(255, 255, 255, 0.75)';
    context.font = '600 18px Arial';
    context.textAlign = 'center';
    context.fillText('Your chart will appear here', canvas.width / 2, canvas.height / 2 - 4);
    context.font = '400 12px Arial';
    context.fillStyle = 'rgba(255, 255, 255, 0.56)';
    context.fillText('Log a salary to start comparing pay to inflation', canvas.width / 2, canvas.height / 2 + 22);
}

function applyReadOnlyUi() {
    const form = document.getElementById('salaryForm');
    if (form) {
        const controls = form.querySelectorAll('input, button, select');
        controls.forEach(control => {
            if (control.id === 'salarySubmitButton' || control.id === 'cancelEditButton') {
                control.disabled = isSharedSnapshotMode;
            } else if (control.tagName === 'INPUT' || control.tagName === 'SELECT') {
                control.disabled = isSharedSnapshotMode;
            }
        });
    }

    const listButtons = document.querySelectorAll('#salaryList button[data-action]');
    listButtons.forEach(button => {
        button.disabled = isSharedSnapshotMode;
    });
}

function isAnonymizedShareLink() {
    return new URLSearchParams(window.location.search).get('shareMode') === 'anonymized';
}

function renderViewButtons() {
    const isAnonymizedLink = isAnonymizedShareLink();
    document.querySelectorAll('.view-toggle button').forEach(button => {
        const isSelected = button.dataset.view === currentViewMode;
        const isDollarButton = button.dataset.view === 'dollar';
        button.classList.toggle('is-active', isSelected);
        button.disabled = isAnonymizedLink && isDollarButton;
        button.setAttribute('aria-disabled', String(isAnonymizedLink && isDollarButton));
    });
}

function saveToLocalStorage(data) {
    const normalizedData = sanitizeSalaryData(data);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedData));
    } catch (error) {
        console.warn('Unable to save to localStorage.', error);
    }
    return normalizedData;
}

function loadFromLocalStorage() {
    try {
        const rawValue = localStorage.getItem(STORAGE_KEY);
        if (!rawValue) {
            return [];
        }

        const parsed = JSON.parse(rawValue);
        return sanitizeSalaryData(parsed);
    } catch (error) {
        console.warn('Unable to load from localStorage.', error);
        return [];
    }
}

function getCurrentMonthString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeMonthString(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const trimmedValue = String(value).trim();
    if (!trimmedValue) {
        return null;
    }

    const monthMatch = trimmedValue.match(/^\d{4}-\d{2}$/);
    if (monthMatch) {
        const [year, month] = trimmedValue.split('-');
        return `${year}-${month}`;
    }

    const dateMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
        const [, year, month] = dateMatch;
        return `${year}-${month}`;
    }

    const dateValue = new Date(trimmedValue);
    if (!Number.isNaN(dateValue.getTime())) {
        const year = dateValue.getUTCFullYear();
        const month = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    return null;
}

function normalizePayType(value) {
    return VALID_PAY_TYPES.has(value) ? value : DEFAULT_PAY_TYPE;
}

function normalizeAmountValue(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
        return 0;
    }
    return Number(amount.toFixed(2));
}

function normalizeHoursValue(value) {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours <= 0) {
        return 0;
    }
    return Number(Math.min(MAX_HOURS_PER_WEEK, hours).toFixed(1));
}

function normalizeSalaryEntry(entry, index) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }

    const startDate = normalizeMonthString(entry.startDate);
    if (!startDate) {
        return null;
    }

    const normalizedPayType = normalizePayType(entry.payType);
    const amount = normalizeAmountValue(entry.amount);

    return {
        id: entry.id || `salary-${Date.now()}-${index}`,
        startDate,
        amount,
        payType: normalizedPayType,
        hoursPerWeek: normalizedPayType === 'hourly_part_time' ? normalizeHoursValue(entry.hoursPerWeek) : null,
    };
}

function applyCurrentMonthLimits() {
    const maxMonth = getCurrentMonthString();
    const monthInputs = document.querySelectorAll('input[type="month"]');
    monthInputs.forEach(input => {
        input.max = maxMonth;
        if (input.value && input.value > maxMonth) {
            input.value = maxMonth;
        }
    });
}

function sanitizeSalaryData(data) {
    if (!Array.isArray(data)) {
        return [];
    }

    const maxMonth = getCurrentMonthString();
    const normalizedEntries = data
        .map((entry, index) => normalizeSalaryEntry(entry, index))
        .filter(Boolean)
        .filter(entry => entry.startDate <= maxMonth);

    return sortSalaryData(normalizedEntries);
}

function sortSalaryData(data) {
    return [...data].sort((a, b) => {
        const dateA = new Date(`${a.startDate}-01T00:00:00Z`);
        const dateB = new Date(`${b.startDate}-01T00:00:00Z`);
        return dateA - dateB;
    });
}

function getSelectedPayType() {
    return document.querySelector('input[name="salaryType"]:checked')?.value || 'salary';
}

function getOriginalListValue(entry, field) {
    if (field === 'amount') {
        return Number(entry.amount || 0).toFixed(2);
    }
    if (field === 'hoursPerWeek') {
        const hours = Number(entry.hoursPerWeek || 0);
        return Number.isFinite(hours) ? String(hours.toFixed(1)) : '0.0';
    }
    return entry[field] ?? '';
}

function updatePayTypeUi() {
    const selectedType = getSelectedPayType();
    const partTimeWrapper = document.getElementById('partTimeHoursWrapper');
    const amountLabel = document.getElementById('amountLabel');
    const hoursField = document.getElementById('hoursPerWeek');

    const isPartTime = selectedType === 'hourly_part_time';
    partTimeWrapper.classList.toggle('hidden', !isPartTime);
    amountLabel.textContent = selectedType === 'salary' ? 'Amount' : 'Hourly rate';

    if (hoursField) {
        hoursField.max = String(MAX_HOURS_PER_WEEK);
        hoursField.min = '1';
        if (Number(hoursField.value) > MAX_HOURS_PER_WEEK) {
            hoursField.value = String(MAX_HOURS_PER_WEEK);
        }
    }
}

function getAnnualizedAmount(entry) {
    const amount = Number(entry.amount || 0);
    if (!entry || !Number.isFinite(amount)) {
        return 0;
    }

    switch (entry.payType) {
        case 'hourly_full_time':
            return amount * 40 * 52;
        case 'hourly_part_time':
            return amount * ((Number(entry.hoursPerWeek) || 0) * 52);
        default:
            return amount;
    }
}

function renderSalaryList() {
    const list = document.getElementById('salaryList');
    if (!list) {
        return;
    }

    if (!salaryData.length) {
        list.innerHTML = '<p class="empty-state">No salary entries yet. Add your first salary to begin.</p>';
        return;
    }

    const maxMonth = getCurrentMonthString();
    list.innerHTML = salaryData.map(entry => `
        <div class="salary-row">
            <input type="month" data-id="${entry.id}" data-field="startDate" value="${entry.startDate}" max="${maxMonth}" aria-label="Salary start month" ${isSharedSnapshotMode ? 'disabled' : ''}>
            <select data-id="${entry.id}" data-field="payType" aria-label="Salary type" ${isSharedSnapshotMode ? 'disabled' : ''}>
                <option value="salary" ${entry.payType === 'salary' ? 'selected' : ''}>Salary</option>
                <option value="hourly_full_time" ${entry.payType === 'hourly_full_time' ? 'selected' : ''}>Hourly (Full Time)</option>
                <option value="hourly_part_time" ${entry.payType === 'hourly_part_time' ? 'selected' : ''}>Hourly (Part Time)</option>
            </select>
            <input type="number" min="0" step="0.01" data-id="${entry.id}" data-field="amount" value="${Number(entry.amount).toFixed(2)}" aria-label="Salary amount" ${isSharedSnapshotMode ? 'disabled' : ''}>
            ${entry.payType === 'hourly_part_time' ? `<input type="number" min="1" step="0.5" data-id="${entry.id}" data-field="hoursPerWeek" value="${Number(entry.hoursPerWeek || 0).toFixed(1)}" aria-label="Hours per week" ${isSharedSnapshotMode ? 'disabled' : ''}>` : '<span class="muted-label">-</span>'}
            <div class="salary-actions">
                <button type="button" data-action="edit" data-id="${entry.id}" ${isSharedSnapshotMode ? 'disabled' : ''}>Edit</button>
                <button type="button" class="delete-button" data-action="delete" data-id="${entry.id}" ${isSharedSnapshotMode ? 'disabled' : ''}>Delete</button>
            </div>
        </div>
    `).join('');
}

function encodeSharePayload(data) {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function decodeSharePayload(payload) {
    const normalizedPayload = payload
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const paddedPayload = normalizedPayload + '='.repeat((4 - (normalizedPayload.length % 4)) % 4);
    const binary = atob(paddedPayload);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
}

function getUrlPayload() {
    const hashPayload = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
    if (hashPayload) {
        const decoded = deserializeData(hashPayload);
        if (decoded.length) {
            return decoded;
        }
    }

    const searchParam = new URLSearchParams(window.location.search).get('salaryData');
    if (searchParam) {
        const decoded = deserializeData(searchParam);
        if (decoded.length) {
            return decoded;
        }
    }

    return null;
}

function serializeData(data, anonymize = false) {
    const normalizedData = sanitizeSalaryData(data);
    if (!normalizedData.length) {
        return encodeSharePayload([]);
    }

    const payload = anonymize ? normalizedData.map((entry, index) => {
        const baseValue = Number(normalizedData[0].amount) || 100;
        return {
            ...entry,
            id: entry.id || `salary-${index + 1}`,
            amount: Number(((Number(entry.amount) / baseValue) * 100).toFixed(4)),
        };
    }) : normalizedData;

    return encodeSharePayload(payload);
}

function deserializeData(urlHash) {
    try {
        const cleanedValue = String(urlHash || '').replace(/^#/, '').trim();
        if (!cleanedValue) {
            return [];
        }

        const parsed = decodeSharePayload(cleanedValue);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return sanitizeSalaryData(parsed);
    } catch (error) {
        console.warn('Unable to deserialize URL payload.', error);
        return [];
    }
}

function showSavePrompt(message = 'Save this salary history to this browser on this device?\nThis stays in local storage unless you choose to share it.') {
    const prompt = document.getElementById('savePrompt');
    const promptText = document.getElementById('savePromptText');
    if (prompt) {
        prompt.classList.remove('hidden');
    }
    if (promptText) {
        promptText.textContent = message;
    }
}

function hideSavePrompt() {
    const prompt = document.getElementById('savePrompt');
    if (prompt) {
        prompt.classList.add('hidden');
    }
}

function updateShareUi() {
    const selectedMode = document.querySelector('input[name="shareMode"]:checked').value;
    const exactWarning = document.getElementById('exactShareWarning');
    const exactCheckbox = document.getElementById('exactShareConfirm');
    const exactButton = document.getElementById('copyExactLinkButton');
    const genericButton = document.getElementById('copyShareLinkButton');

    const isExact = selectedMode === 'exact';
    const isSite = selectedMode === 'site';
    exactWarning.classList.toggle('hidden', !isExact);
    exactCheckbox.closest('label').classList.toggle('hidden', !isExact);
    exactButton.disabled = !isExact || !exactCheckbox.checked;

    genericButton.textContent = isSite ? 'Copy Site Link' : 'Copy Share Link';
    genericButton.classList.toggle('hidden', isExact);
    exactButton.classList.toggle('hidden', !isExact);
}

async function copyShareLink(mode) {
    const shareUrl = new URL(window.location.href);
    shareUrl.hash = '';
    shareUrl.searchParams.delete('salaryData');
    shareUrl.searchParams.delete('shareMode');
    shareUrl.searchParams.delete('viewMode');

    if (mode === 'site') {
        try {
            await navigator.clipboard.writeText(shareUrl.toString());
            showShareStatus('Site link copied to clipboard.');
        } catch (error) {
            console.warn('Clipboard copy failed.', error);
            showShareStatus('Clipboard access was blocked. Please copy the URL manually.');
        }
        return;
    }

    const exactMode = Boolean(mode);
    const payload = serializeData(salaryData, exactMode ? false : true);
    shareUrl.searchParams.set('salaryData', payload);
    shareUrl.searchParams.set('shareMode', exactMode ? 'exact' : 'anonymized');
    shareUrl.searchParams.set('viewMode', exactMode ? 'dollar' : 'normalized');

    try {
        await navigator.clipboard.writeText(shareUrl.toString());
        const statusText = exactMode ? 'Exact link copied to clipboard.' : 'Anonymized share link copied to clipboard.';
        showShareStatus(statusText);
    } catch (error) {
        console.warn('Clipboard copy failed.', error);
        showShareStatus('Clipboard access was blocked. Please copy the URL manually.');
    }
}

function showShareStatus(message) {
    const status = document.getElementById('shareStatus');
    status.textContent = message;
    status.classList.remove('hidden');
    window.setTimeout(() => {
        status.classList.add('hidden');
    }, 2200);
}

function formatSignedPercent(value) {
    const numericValue = Number(value);
    const sign = numericValue > 0 ? '+' : '';
    return `${sign}${numericValue.toFixed(1)}%`;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(Number(amount || 0));
}

function formatCompactCurrency(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return '$0';
    }

    const prefix = numericValue < 0 ? '-' : '';
    const absValue = Math.abs(numericValue);

    if (absValue < 1000) {
        return `${prefix}$${absValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }

    const compactValue = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
        minimumFractionDigits: 0
    }).format(absValue).replace(/K$/i, 'k');

    return `${prefix}$${compactValue}`;
}

function displayCombinedSalaryGraph(salaries, viewMode = currentViewMode) {
    if (!salaries || salaries.length === 0) {
        return;
    }

    const sortedSalaries = sortSalaryData(salaries);
    let noInflationSalary = [];
    let inflationAdjustedSalary = [];
    let rangeLabels = [];
    let startingCPI;
    const firstSalaryAmount = getAnnualizedAmount(sortedSalaries[0]) || 1;

    const subtitle = document.getElementById('salaryGraphSubtitle');
    if (subtitle) {
        subtitle.textContent = 'Actual pay vs. inflation over time.';
    }

    const firstSalaryMonth = sortedSalaries[0]?.startDate;
    const firstSalaryMonthLabel = firstSalaryMonth
        ? new Date(`${firstSalaryMonth}-01T00:00:00`).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        })
        : 'first salary';

    const currentMonth = getCurrentMonthString();
    const currentMonthParts = currentMonth.split('-');
    const currentYear = Number(currentMonthParts[0]);
    const currentMonthIndex = Number(currentMonthParts[1]) - 1;

    sortedSalaries.forEach((salary, index) => {
        const startDate = salary.startDate;
        const startYear = startDate.split('-')[0];
        const startMonth = MONTHS[Number(startDate.split('-')[1]) - 1];
        const endDate = sortedSalaries[index + 1] ? sortedSalaries[index + 1].startDate : currentMonth;
        const endYear = endDate.split('-')[0];
        const endMonth = MONTHS[Number(endDate.split('-')[1]) - 1];
        const startSalary = getAnnualizedAmount(salary);

        if (startingCPI === undefined) {
            startingCPI = cpiForYearMonth(startYear, startMonth);
        }

        const noInflationRange = getFixedCPIArray(startYear, startMonth, endYear, endMonth);
        const rawNoInflationValues = getEffectiveSalaryValues(startSalary, noInflationRange);
        noInflationSalary = noInflationSalary.concat(
            viewMode === 'normalized'
                ? rawNoInflationValues.map(value => ((value / firstSalaryAmount) * 100) - 100)
                : rawNoInflationValues
        );

        const inflationRange = getCPIForRange(startYear, startMonth, endYear, endMonth);
        const adjustedBase = inflationAdjust(startSalary, startingCPI, cpiForYearMonth(startYear, startMonth));
        const rawInflationValues = getEffectiveSalaryValues(adjustedBase, inflationRange);
        inflationAdjustedSalary = inflationAdjustedSalary.concat(
            viewMode === 'normalized'
                ? rawInflationValues.map(value => ((value / firstSalaryAmount) * 100) - 100)
                : rawInflationValues
        );

        rangeLabels = rangeLabels.concat(getLabelsForRange(startYear, startMonth, endYear, endMonth));
    });

    const ctx = document.getElementById('salaryGraph').getContext('2d');

    if (currentChart) {
        currentChart.destroy();
    }

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: rangeLabels,
            datasets: [{
                label: 'Actual salary',
                data: noInflationSalary,
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: 'rgba(75, 192, 192, 1)'
            }, {
                label: `Inflation adjusted (${firstSalaryMonthLabel} dollars)`,
                data: inflationAdjustedSalary,
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: 'rgba(255, 99, 132, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: {
                mode: 'nearest',
                intersect: false
            },
            spanGaps: true,
            layout: {
                padding: {
                    left: 4,
                    right: 8,
                    top: 8,
                    bottom: 0
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = Number(context.parsed.y);
                            if (viewMode === 'normalized') {
                                return `${context.dataset.label}: ${formatSignedPercent(value)}`;
                            }
                            return `${context.dataset.label}: $${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxTicksLimit: 10,
                        autoSkip: true,
                        maxRotation: 0,
                        minRotation: 0
                    }
                },
                y: {
                    beginAtZero: false,
                    grace: '8%',
                    ticks: {
                        maxTicksLimit: 6,
                        padding: 2,
                        autoSkip: true,
                        font: {
                            size: window.innerWidth < 560 ? 10 : 11
                        },
                        callback: (value) => {
                            if (viewMode === 'normalized') {
                                return formatSignedPercent(value);
                            }
                            return formatCompactCurrency(value);
                        }
                    },
                    title: {
                        display: false,
                        text: viewMode === 'normalized'
                            ? `Percent change vs ${firstSalaryMonthLabel}`
                            : 'Dollars',
                        padding: { top: 0, bottom: 8 }
                    }
                }
            }
        }
    });
}

function calculateSalaryStats(data) {
    const safeData = sanitizeSalaryData(data || []);
    if (!safeData.length) {
        return {
            startingAnnualSalary: 0,
            currentAnnualSalary: 0,
            totalChangePercent: 0,
            annualizedGrowthPercent: 0,
            inflationAdjustedChangePercent: 0,
            inflationAdjustedAnnualizedGrowthPercent: 0,
            cumulativeInflationPercent: 0,
            averageAnnualIncrease: 0,
            realAnnualIncrease: 0,
        };
    }

    const firstEntry = safeData[0];
    const lastEntry = safeData[safeData.length - 1];
    const firstAnnual = getAnnualizedAmount(firstEntry) || 0;
    const currentAnnual = getAnnualizedAmount(lastEntry) || 0;

    const totalChangePercent = firstAnnual ? ((currentAnnual - firstAnnual) / firstAnnual) * 100 : 0;
    const timeInYears = getYearsBetweenDates(firstEntry.startDate, lastEntry.startDate);
    const annualizedGrowthPercent = timeInYears > 0 && firstAnnual > 0
        ? ((Math.pow(currentAnnual / firstAnnual, 1 / timeInYears) - 1) * 100)
        : 0;

    const startCPI = getCPIForMonthValue(firstEntry.startDate);
    const latestCPIDate = getCurrentMonthString();
    const latestCPI = getCPIForMonthValue(latestCPIDate);

    const cumulativeInflationPercent = startCPI && latestCPI
        ? ((latestCPI / startCPI) - 1) * 100
        : 0;

    const inflationAdjustedCurrentAnnual = startCPI && latestCPI && currentAnnual > 0
        ? currentAnnual * (startCPI / latestCPI)
        : currentAnnual;

    const yearsToLatest = Math.max(getYearsBetweenDates(firstEntry.startDate, latestCPIDate), 1 / 12);
    const inflationAdjustedChangePercent = startCPI && latestCPI && firstAnnual > 0
        ? ((inflationAdjustedCurrentAnnual / firstAnnual) - 1) * 100
        : 0;
    const inflationAdjustedAnnualizedGrowthPercent = startCPI && latestCPI && firstAnnual > 0
        ? ((Math.pow(inflationAdjustedCurrentAnnual / firstAnnual, 1 / yearsToLatest) - 1) * 100)
        : 0;

    const averageAnnualIncrease = timeInYears > 0 ? (currentAnnual - firstAnnual) / timeInYears : 0;
    const realAnnualIncrease = startCPI && latestCPI && yearsToLatest > 0
        ? (inflationAdjustedCurrentAnnual - firstAnnual) / yearsToLatest
        : 0;

    return {
        startingAnnualSalary: firstAnnual,
        currentAnnualSalary: currentAnnual,
        totalChangePercent,
        annualizedGrowthPercent,
        inflationAdjustedChangePercent,
        inflationAdjustedAnnualizedGrowthPercent,
        cumulativeInflationPercent,
        averageAnnualIncrease,
        realAnnualIncrease,
    };
}

function getYearsBetweenDates(startDate, endDate) {
    const start = new Date(`${startDate}-01T00:00:00Z`);
    const end = new Date(`${endDate}-01T00:00:00Z`);
    const monthsBetween = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
    return Math.max(monthsBetween / 12, 1 / 12);
}

function getCPIForMonthValue(dateString) {
    if (!dateString || typeof dateString !== 'string') {
        return null;
    }

    if (typeof CPI === 'undefined' || !CPI) {
        return null;
    }

    const [year, month] = dateString.split('-');
    if (!year || !month) {
        return null;
    }

    const normalizedMonth = Number(month) >= 1 && Number(month) <= 12
        ? MONTHS[Number(month) - 1]
        : month;

    return cpiForYearMonth(year, normalizedMonth);
}

function renderSalaryStats() {
    const panel = document.getElementById('salaryStatsPanel');
    const statsGrid = document.getElementById('salaryStatsGrid');
    if (!panel || !statsGrid) {
        return;
    }

    if (!salaryData.length) {
        panel.classList.add('hidden');
        return;
    }

    panel.classList.remove('hidden');

    const stats = calculateSalaryStats(salaryData);
    const cards = [
        {
            label: 'Starting salary',
            value: formatCurrency(stats.startingAnnualSalary),
            helper: 'first annualized salary',
            help: 'The first salary in your list, annualized into a yearly number so it matches later salary entries.'
        },
        {
            label: 'Current salary',
            value: formatCurrency(stats.currentAnnualSalary),
            helper: 'latest annualized salary',
            help: 'The most recent salary in your history, annualized so it is directly comparable to earlier years.'
        },
        {
            label: 'Total change',
            value: `${formatSignedPercent(stats.totalChangePercent)}`,
            helper: 'vs first salary',
            help: 'Percentage change from your first logged salary to your latest salary. This is purely nominal, before inflation.'
        },
        {
            label: 'Annualized growth',
            value: `${formatSignedPercent(stats.annualizedGrowthPercent)}`,
            helper: 'nominal yearly increase',
            help: 'Average yearly percentage gain in salary, treating the whole change as a compound rate over time.'
        },
        {
            label: 'Real annualized growth',
            value: `${formatSignedPercent(stats.inflationAdjustedAnnualizedGrowthPercent)}`,
            helper: 'since first salary, adjusted to current CPI',
            help: 'Formula: ((currentSalary × (startingCPI / currentCPI)) / startingSalary)^(1 / yearsSinceStart) - 1. This annualizes your salary growth after inflation by comparing your salary to the equivalent value in today’s dollars.'
        },
        {
            label: 'Inflation since start',
            value: `${formatSignedPercent(stats.cumulativeInflationPercent)}`,
            helper: 'CPI increase',
            help: 'How much prices have risen since your first salary date according to CPI. This is the inflation effect the salary growth has to overcome.'
        },
        {
            label: 'Real wage change',
            value: `${formatSignedPercent(stats.inflationAdjustedChangePercent)}`,
            helper: 'first salary vs today’s CPI-adjusted value',
            help: 'Formula: ((currentSalary × (startingCPI / currentCPI)) / startingSalary) - 1. This shows the total change in salary after inflation, using today’s purchasing power to adjust the current salary back to the starting CPI.'
        },
        {
            label: 'Avg yearly raise (nominal)',
            value: formatCurrency(stats.averageAnnualIncrease),
            helper: 'current dollars, before inflation',
            help: 'Average annual raise in raw dollars, before accounting for inflation. This is the raise in nominal terms.'
        },
        {
            label: 'Real yearly raise',
            value: formatCurrency(stats.realAnnualIncrease),
            helper: 'inflation-adjusted, compared to start',
            help: 'Average annual raise after inflation, expressed in today’s purchasing power relative to your starting salary.'
        }
    ];

    statsGrid.innerHTML = cards.map(card => `
        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-label">${card.label}</div>
                <button class="stat-info" type="button" aria-label="More about ${card.label}" title="${card.help}">i</button>
            </div>
            <div class="stat-value">${card.value}</div>
            <div class="stat-helper">${card.helper}</div>
        </div>
    `).join('');
}

function renderChart() {
    displayCombinedSalaryGraph(salaryData, currentViewMode);
}

function addMonthsToDateString(dateString, months) {
    const safeDateString = `${dateString}-01`;
    const date = new Date(`${safeDateString}T00:00:00Z`);
    const month = date.getUTCMonth();
    const year = date.getUTCFullYear();
    const target = new Date(Date.UTC(year, month + months, 1));
    return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}`;
}

function displayCPI() {
    const cpiDataDiv = document.getElementById('cpi-data');
    if (cpiDataDiv) {
        cpiDataDiv.textContent = `test \n ${CPI[2022].Apr}`;
    }
}

function cpiHasValue(year, month) {
    return cpiForYearMonth(year, month) !== null;
}

function cpiForYearMonth(year, month) {
    const numericYear = Number(year);
    const monthKey = typeof month === 'string' && month.length === 2 && /^\d{2}$/.test(month)
        ? MONTHS[Number(month) - 1]
        : month;
    const yearData = CPI[numericYear];

    if (yearData && yearData[monthKey] !== undefined) {
        return yearData[monthKey];
    }

    const monthIndex = MONTHS.indexOf(monthKey);
    if (yearData && monthIndex >= 0) {
        for (let i = monthIndex; i >= 0; i--) {
            const previousMonth = MONTHS[i];
            if (yearData[previousMonth] !== undefined) {
                return yearData[previousMonth];
            }
        }
    }

    const years = Object.keys(CPI)
        .map(Number)
        .filter(yearValue => yearValue <= numericYear)
        .sort((a, b) => b - a);

    for (const previousYear of years) {
        const previousYearData = CPI[previousYear];
        if (!previousYearData) continue;

        for (let i = MONTHS.length - 1; i >= 0; i--) {
            const previousMonth = MONTHS[i];
            if (previousYearData[previousMonth] !== undefined) {
                return previousYearData[previousMonth];
            }
        }
    }

    return null;
}

function getCPIForRange(startYear, startMonth, endYear, endMonth) {
    const cpis = [];
    const startMonthIdx = MONTHS.indexOf(startMonth);
    const endMonthIdx = MONTHS.indexOf(endMonth);

    for (let i = startYear; i <= endYear; i++) {
        let monthStart = (i === startYear) ? startMonthIdx : 0;
        let monthEnd = (i === endYear) ? endMonthIdx : MONTHS.length - 1;

        for (let j = monthStart; j <= monthEnd; j++) {
            const value = cpiForYearMonth(i, MONTHS[j]);
            if (value !== null) {
                cpis.push(value);
            }
        }
    }
    return cpis;
}

function getFixedCPIArray(startYear, startMonth, endYear, endMonth) {
    const cpis = [];
    const startMonthIdx = MONTHS.indexOf(startMonth);
    const endMonthIdx = MONTHS.indexOf(endMonth);

    const day1CPI = cpiForYearMonth(startYear, startMonth);
    if (day1CPI === null) {
        return cpis;
    }

    for (let i = startYear; i <= endYear; i++) {
        let monthStart = (i === startYear) ? startMonthIdx : 0;
        let monthEnd = (i === endYear) ? endMonthIdx : MONTHS.length - 1;

        for (let j = monthStart; j <= monthEnd; j++) {
            cpis.push(day1CPI);
        }
    }
    return cpis;
}

function inflationDifference(startCPI, endCPI) {
    if (startCPI === null || startCPI === undefined || startCPI === 0 ||
        endCPI === null || endCPI === undefined || endCPI === 0) {
        return 0;
    }

    return startCPI / endCPI;
}

function inflationAdjust(value, startCPI, endCPI) {
    return value * inflationDifference(startCPI, endCPI);
}

function getEffectiveSalaryValues(startSalary, cpiForRange) {
    if (!cpiForRange || cpiForRange.length === 0) {
        return [];
    }

    const effectiveSalary = [];
    for (let i = 0; i < cpiForRange.length; i++) {
        const startCPI = cpiForRange[0];
        effectiveSalary.push(startSalary * inflationDifference(startCPI, cpiForRange[i]));
    }
    return effectiveSalary;
}

function getLabelsForRange(startYear, startMonth, endYear, endMonth) {
    const labels = [];
    for (let i = startYear; i <= endYear; i++) {
        let monthStart = (i === startYear) ? MONTHS.indexOf(startMonth) : 0;
        let monthEnd = (i === endYear) ? MONTHS.indexOf(endMonth) : MONTHS.length - 1;

        for (let j = monthStart; j <= monthEnd; j++) {
            labels.push(`${i}|${MONTHS[j]}`);
        }
    }
    return labels;
}

function getAllCPI() {
    const years = Object.keys(CPI);

    const cpis = [];

    years.forEach(year => {
        MONTHS.forEach(month => {
            cpis.push(CPI[year][month]);
        });
    });

    return cpis;
}

function getAllCPILabels() {
    const years = Object.keys(CPI);

    const labels = [];
    years.forEach(year => {
        MONTHS.forEach(month => {
            labels.push(`${year}|${month}`);
        });
    });
    return labels;
}

function displayCPIGraph() {
    const ctx = document.getElementById('cpiGraph').getContext('2d');
    
    // Define the labels and CPI data
    const labels = getAllCPILabels();
    const cpiData = getAllCPI(); // Example CPI data

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels, // Update labels
            datasets: [{
                label: 'CPI Data',
                data: cpiData, // Update data
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}