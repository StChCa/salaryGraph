const MONTHS = [`Jan`, `Feb`, `Mar`, `Apr`, `May`, `Jun`, `Jul`, `Aug`, `Sep`, `Oct`, `Nov`, `Dec`];

document.addEventListener('DOMContentLoaded', () => {
    // displayCPI();
    displayCPISalaryGraph(Salaries);
    displayInflationResetSalaryGraph(Salaries);
    displayInflationSalaryGraph(Salaries);
    // displayCPIGraph();
});


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
    const yearData = CPI[numericYear];

    if (yearData && yearData[month] !== undefined) {
        return yearData[month];
    }

    const monthIndex = MONTHS.indexOf(month);
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
    if (startCPI === null || startCPI === undefined || startCPI === 0) {
        return 0;
    }

    return (1 - (endCPI - startCPI) / startCPI);
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

// GRAPH 1
// Graph that displays a graph of multiple salaries.
// No inflation adjustments.
function displayCPISalaryGraph(salaries) {

    let effectiveSalary = [];
    let rangeLabels = [];
    
    salaries.forEach(salary => {
        const startDate = salary.startDate;
        const startYear = startDate.split('-')[0];
        const startMonth = MONTHS[Number(startDate.split('-')[1]) - 1];
        const endDate = salary.endDate;
        const endYear = endDate.split('-')[0];
        const endMonth = MONTHS[Number(endDate.split('-')[1]) - 1];
        const startSalary = salary.salary;

        const cpiForRange = getFixedCPIArray(startYear, startMonth, endYear, endMonth);
        effectiveSalary = effectiveSalary.concat(getEffectiveSalaryValues(startSalary, cpiForRange));
        rangeLabels = rangeLabels.concat(getLabelsForRange(startYear, startMonth, endYear, endMonth));

    });
    
    const ctx = document.getElementById('salaryGraph').getContext('2d');
    
    // Define the labels and CPI data
    const labels = rangeLabels;
    const cpiData = effectiveSalary;
    let cpiDat2 = [];
    for (let i = 0; i < cpiData.length; i++) {
        cpiDat2.push(cpiData[i] +1000);
    }

    console.log(`cpiDat2 ${cpiDat2}`);

    graphObject = {
        type: 'line',
        data: {
            labels: labels, // Update labels
            datasets: [{
                label: 'CPI Data',
                data: cpiData, // Update data
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            },
            {
                label: 'CPI Data 2',
                data: cpiDat2, // Update data
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
    }

    new Chart(ctx, graphObject);
}

// GRAPH 2
// Graph that displays a graph of multiple salaries.
// Each Salary is represented in dollars at the start of THAT salary.
function displayInflationResetSalaryGraph(salaries) {

    let effectiveSalary = [];
    let rangeLabels = [];

    salaries.forEach(salary => {
        const startDate = salary.startDate;
        const startYear = startDate.split('-')[0];
        const startMonth = MONTHS[Number(startDate.split('-')[1]) - 1];
        const endDate = salary.endDate;
        const endYear = endDate.split('-')[0];
        const endMonth = MONTHS[Number(endDate.split('-')[1]) - 1];
        const startSalary = salary.salary;

        const cpiForRange = getCPIForRange(startYear, startMonth, endYear, endMonth);
        effectiveSalary = effectiveSalary.concat(getEffectiveSalaryValues(startSalary, cpiForRange));
        rangeLabels = rangeLabels.concat(getLabelsForRange(startYear, startMonth, endYear, endMonth));

    });
    
    const ctx = document.getElementById('inflation-reset-salary-graph').getContext('2d');
    
    // Define the labels and CPI data
    const labels = rangeLabels;
    const cpiData = effectiveSalary;

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

// GRAPH 3
// Graph that displays a graph of multiple salaries.
// All values are in Salary1 Day 1 dollars.
function displayInflationSalaryGraph(salaries) {

    let effectiveSalary = [];
    let rangeLabels = [];

    let startingCPI;

    salaries.forEach(salary => {
        const startDate = salary.startDate;
        const startYear = startDate.split('-')[0];
        const startMonth = MONTHS[Number(startDate.split('-')[1]) - 1];
        const endDate = salary.endDate;
        const endYear = endDate.split('-')[0];
        const endMonth = MONTHS[Number(endDate.split('-')[1]) - 1];
        const startSalary = salary.salary;

        if (startingCPI === undefined) {
            startingCPI = cpiForYearMonth(startYear, startMonth);
        }

        const cpiForRange = getCPIForRange(startYear, startMonth, endYear, endMonth);
        effectiveSalary = effectiveSalary.concat(getEffectiveSalaryValues(inflationAdjust(startSalary, startingCPI, cpiForYearMonth(startYear, startMonth)), cpiForRange));
        rangeLabels = rangeLabels.concat(getLabelsForRange(startYear, startMonth, endYear, endMonth));

    });
    
    const ctx = document.getElementById('no-reset-salary-graph').getContext('2d');
    
    // Define the labels and CPI data
    const labels = rangeLabels;
    const cpiData = effectiveSalary;

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