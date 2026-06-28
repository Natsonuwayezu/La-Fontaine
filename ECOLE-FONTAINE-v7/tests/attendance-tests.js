// tests/attendance-tests.js
// Attendance module tests

export async function testAttendanceModule() {
    console.log('Running attendance tests...');

    const tests = [
        testAttendanceCalculation,
        testAttendanceRate,
        testMonthlySummary,
        testStudentAttendance,
        testMarkingPeriod
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            await test();
            console.log(`✅ ${test.name} passed`);
            passed++;
        } catch (error) {
            console.error(`❌ ${test.name} failed:`, error.message);
            failed++;
        }
    }

    console.log(`Attendance tests: ${passed} passed, ${failed} failed`);
    return { passed, failed };
}

async function testAttendanceCalculation() {
    const attendance = [
        { status: 'present' },
        { status: 'present' },
        { status: 'absent' },
        { status: 'present' },
        { status: 'late' },
        { status: 'present' },
        { status: 'absent' }
    ];

    const present = attendance.filter(a => a.status === 'present').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const late = attendance.filter(a => a.status === 'late').length;

    if (present !== 4) throw new Error(`Present count incorrect: ${present}, expected 4`);
    if (absent !== 2) throw new Error(`Absent count incorrect: ${absent}, expected 2`);
    if (late !== 1) throw new Error(`Late count incorrect: ${late}, expected 1`);
}

async function testAttendanceRate() {
    const totalDays = 20;
    const present = 16;
    const expectedRate = 80;

    const rate = (present / totalDays) * 100;
    if (rate !== expectedRate) {
        throw new Error(`Attendance rate incorrect: ${rate}%, expected ${expectedRate}%`);
    }
}

async function testMonthlySummary() {
    const dailyAttendance = [
        { date: '2026-01-01', status: 'present' },
        { date: '2026-01-02', status: 'present' },
        { date: '2026-01-03', status: 'absent' },
        { date: '2026-02-01', status: 'present' },
        { date: '2026-02-02', status: 'late' }
    ];

    const monthlySummary = {};
    for (const record of dailyAttendance) {
        const month = record.date.slice(0, 7);
        if (!monthlySummary[month]) {
            monthlySummary[month] = { present: 0, absent: 0, late: 0 };
        }
        monthlySummary[month][record.status]++;
    }

    if (monthlySummary['2026-01'].present !== 2) throw new Error('January present count incorrect');
    if (monthlySummary['2026-01'].absent !== 1) throw new Error('January absent count incorrect');
    if (monthlySummary['2026-02'].present !== 1) throw new Error('February present count incorrect');
    if (monthlySummary['2026-02'].late !== 1) throw new Error('February late count incorrect');
}

async function testStudentAttendance() {
    const studentAttendance = {
        'STU001': { present: 18, absent: 2, late: 0, total: 20 },
        'STU002': { present: 15, absent: 3, late: 2, total: 20 },
        'STU003': { present: 20, absent: 0, late: 0, total: 20 }
    };

    // Test calculation of attendance rate
    const rates = {};
    for (const [code, data] of Object.entries(studentAttendance)) {
        rates[code] = (data.present / data.total) * 100;
    }

    if (rates['STU001'] !== 90) throw new Error('STU001 rate incorrect');
    if (rates['STU002'] !== 75) throw new Error('STU002 rate incorrect');
    if (rates['STU003'] !== 100) throw new Error('STU003 rate incorrect');
}

async function testMarkingPeriod() {
    const startDate = new Date('2026-01-10');
    const endDate = new Date('2026-03-20');
    const testDate = new Date('2026-02-15');
    const outsideDate = new Date('2026-04-01');

    function isWithinPeriod(date, start, end) {
        return date >= start && date <= end;
    }

    if (!isWithinPeriod(testDate, startDate, endDate)) {
        throw new Error('Date within period incorrectly marked as outside');
    }

    if (isWithinPeriod(outsideDate, startDate, endDate)) {
        throw new Error('Date outside period incorrectly marked as within');
    }
}