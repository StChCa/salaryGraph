const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const mainScript = fs.readFileSync('./main.js', 'utf8');
const context = {
  console,
  CPI: {
    2020: { Jan: 100 },
    2023: { Jan: 124.6 },
    2025: { Jan: 100 },
    2026: { Aug: 130 },
  },
  document: {
    addEventListener() {},
    querySelectorAll() { return []; },
    getElementById() { return null; },
    querySelector() { return null; },
  },
  window: {
    location: { search: '', href: 'http://localhost/' },
    confirm() { return true; },
    setTimeout() {},
  },
  localStorage: {
    getItem() { return null; },
    setItem() {},
    removeItem() {},
  },
  Chart: function Chart() {},
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  atob: (value) => Buffer.from(value, 'base64').toString('binary'),
  Date,
  Number,
  Math,
  Array,
  Object,
  String,
  Boolean,
  Set,
};

vm.createContext(context);
vm.runInContext(mainScript, context);

function testNormalizeHours() {
  assert.equal(context.normalizeHoursValue(90000), 168);
  assert.equal(context.normalizeHoursValue(20), 20);
  assert.equal(context.normalizeHoursValue(0), 0);
}

function testSanitizeSalaryData() {
  const sanitized = context.sanitizeSalaryData([
    { id: 'b', startDate: '2024-06', amount: '50000', payType: 'salary' },
    { id: 'a', startDate: '2020-02-15', amount: '70000', payType: 'hourly_part_time', hoursPerWeek: '40' },
    { id: 'bad', startDate: 'bad-date', amount: '1000' },
    { id: 'future', startDate: '2099-01', amount: '120000', payType: 'salary' },
  ]);

  assert.equal(sanitized.length, 2);
  assert.equal(sanitized[0].id, 'a');
  assert.equal(sanitized[1].id, 'b');
  assert.equal(sanitized[0].payType, 'hourly_part_time');
  assert.equal(sanitized[0].hoursPerWeek, 40);
}

function testShareRoundTrip() {
  const original = [
    { id: 'salary-1', startDate: '2024-06', amount: 12345.67, payType: 'salary' },
    { id: 'salary-2', startDate: '2025-01', amount: 9876.54, payType: 'hourly_part_time', hoursPerWeek: 25 },
  ];

  const encoded = context.serializeData(original);
  const decoded = context.deserializeData(encoded);

  assert.equal(decoded.length, 2);
  assert.equal(decoded[0].amount, 12345.67);
  assert.equal(decoded[1].hoursPerWeek, 25);
}

function testAnnualizedAmount() {
  assert.equal(context.getAnnualizedAmount({ amount: 100, payType: 'salary' }), 100);
  assert.equal(context.getAnnualizedAmount({ amount: 20, payType: 'hourly_full_time' }), 41600);
  assert.equal(context.getAnnualizedAmount({ amount: 20, payType: 'hourly_part_time', hoursPerWeek: 25 }), 26000);
}

function testIncludedSalaryDataFiltersDisabledEntries() {
  const included = context.getIncludedSalaryData([
    { id: 'keep', startDate: '2020-01', amount: 50000, payType: 'salary' },
    { id: 'drop', startDate: '2023-01', amount: 70000, payType: 'salary', includeInGraph: false },
    { id: 'keep-2', startDate: '2025-01', amount: 90000, payType: 'salary' },
  ]);

  const includedIds = included.map(entry => entry.id);
  assert.equal(includedIds.length, 2);
  assert.equal(includedIds[0], 'keep');
  assert.equal(includedIds[1], 'keep-2');

  const stats = context.calculateSalaryStats([
    { id: 'keep', startDate: '2020-01', amount: 50000, payType: 'salary' },
    { id: 'drop', startDate: '2023-01', amount: 70000, payType: 'salary', includeInGraph: false },
  ]);

  assert.equal(stats.currentAnnualSalary, 50000);
  assert.equal(stats.totalChangePercent, 0);
}

function testSupportAmountNormalization() {
  try {
    const { coerceSupportAmount } = require('../server.js');
    assert.equal(coerceSupportAmount('5'), 5);
    assert.equal(coerceSupportAmount('12.5'), 12.5);
    assert.equal(coerceSupportAmount('0'), 5);
    assert.equal(coerceSupportAmount('abc'), 5);
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw error;
    }
  }
}

function testSalaryStats() {
  const stats = context.calculateSalaryStats([
    { startDate: '2020-01', amount: 50000, payType: 'salary' },
    { startDate: '2023-01', amount: 70000, payType: 'salary' },
  ]);

  assert.equal(stats.currentAnnualSalary, 70000);
  assert.equal(stats.totalChangePercent, 40);
  assert.equal(Math.round(stats.annualizedGrowthPercent * 10) / 10, 11.9);
  assert.equal(Math.round(stats.inflationAdjustedChangePercent * 10) / 10, 7.7);
  assert.equal(Math.round(stats.cumulativeInflationPercent * 10) / 10, 30);
  assert.equal(Math.round(stats.inflationAdjustedAnnualizedGrowthPercent * 10) / 10, 1.1);

  const singleSalaryStats = context.calculateSalaryStats([
    { startDate: '2025-01', amount: 40000, payType: 'salary' },
  ]);

  assert.equal(Math.round(singleSalaryStats.cumulativeInflationPercent * 10) / 10, 30);
  assert.equal(Math.round(singleSalaryStats.inflationAdjustedChangePercent * 10) / 10, -23.1);
  assert.equal(Math.round(singleSalaryStats.inflationAdjustedAnnualizedGrowthPercent * 10) / 10, -15.3);
}

function testCPIGraphStopsAtAvailableCurrentMonth() {
  const labels = context.getAllCPILabels();
  const values = context.getAllCPI();

  assert.equal(context.getLabelsForRange('2023', 'Jan', '2026', 'Aug').at(-1), '2026|Aug');
  assert.equal(labels.at(-1), '2026|Aug');
  assert.equal(values.at(-1), 130);
  assert.equal(labels.length, values.length);
}

function testClearConfirmationGuard() {
  const originalConfirm = context.window.confirm;
  let confirmCalls = 0;
  context.window.confirm = () => {
    confirmCalls += 1;
    return false;
  };

  const result = context.confirmClearData();

  assert.equal(result, false);
  assert.equal(confirmCalls, 1);
  context.window.confirm = originalConfirm;
}

try {
  testNormalizeHours();
  testSanitizeSalaryData();
  testShareRoundTrip();
  testAnnualizedAmount();
  testIncludedSalaryDataFiltersDisabledEntries();
  testSupportAmountNormalization();
  testSalaryStats();
  testCPIGraphStopsAtAvailableCurrentMonth();
  testClearConfirmationGuard();
  console.log('smoke checks passed');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
