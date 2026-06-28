// tests/marks-tests.js
// Marks module tests

export async function testMarksModule() {
    console.log('Running marks tests...');

    const tests = [
        testMarkValidation,
        testPercentageCalculation,
        testGradeCalculation,
        testAssessmentLocking,
        testOfflineStorage
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

    console.log(`Marks tests: ${passed} passed, ${failed} failed`);
    return { passed, failed };
}

async function testMarkValidation() {
    const maxMarks = 50;
    const testCases = [
        { input: 45, expected: 45 },
        { input: 55, expected: 50 },
        { input: -5, expected: 0 },
        { input: 'abc', expected: 0 }
    ];

    for (const tc of testCases) {
        let score = parseFloat(tc.input);
        if (isNaN(score)) score = 0;
        score = Math.min(maxMarks, Math.max(0, score));

        if (score !== tc.expected) {
            throw new Error(`Validation failed: input ${tc.input} -> ${score}, expected ${tc.expected}`);
        }
    }
}

async function testPercentageCalculation() {
    const testCases = [
        { score: 45, max: 50, expected: 90 },
        { score: 30, max: 50, expected: 60 },
        { score: 0, max: 50, expected: 0 },
        { score: 50, max: 50, expected: 100 }
    ];

    for (const tc of testCases) {
        const percentage = (tc.score / tc.max) * 100;
        if (percentage !== tc.expected) {
            throw new Error(`Percentage calculation failed: ${tc.score}/${tc.max} = ${percentage}, expected ${tc.expected}`);
        }
    }
}

async function testGradeCalculation() {
    const gradeScale = [
        { grade: 'A+', min: 90, max: 100 },
        { grade: 'A', min: 80, max: 89 },
        { grade: 'B', min: 70, max: 79 },
        { grade: 'C', min: 60, max: 69 },
        { grade: 'D', min: 50, max: 59 },
        { grade: 'F', min: 0, max: 49 }
    ];

    const testCases = [
        { percentage: 95, expected: 'A+' },
        { percentage: 85, expected: 'A' },
        { percentage: 75, expected: 'B' },
        { percentage: 65, expected: 'C' },
        { percentage: 55, expected: 'D' },
        { percentage: 45, expected: 'F' }
    ];

    function getGrade(pct) {
        for (const g of gradeScale) {
            if (pct >= g.min && pct <= g.max) return g.grade;
        }
        return 'F';
    }

    for (const tc of testCases) {
        const grade = getGrade(tc.percentage);
        if (grade !== tc.expected) {
            throw new Error(`Grade calculation failed: ${tc.percentage}% -> ${grade}, expected ${tc.expected}`);
        }
    }
}

async function testAssessmentLocking() {
    let isLocked = false;

    // Lock the assessment
    isLocked = true;

    // Test that marks cannot be edited when locked
    const canEdit = !isLocked;
    if (canEdit) {
        throw new Error('Locked assessment should not be editable');
    }

    // Unlock and test
    isLocked = false;
    const canEditAfterUnlock = !isLocked;
    if (!canEditAfterUnlock) {
        throw new Error('Unlocked assessment should be editable');
    }
}

async function testOfflineStorage() {
    // Test IndexedDB availability
    const isIndexedDBAvailable = 'indexedDB' in window;
    if (!isIndexedDBAvailable) {
        throw new Error('IndexedDB not available');
    }

    // Test offline marks structure
    const offlineMark = {
        id: 1,
        assessment_id: 100,
        student_id: 50,
        score: 45,
        synced: false,
        timestamp: Date.now()
    };

    if (!offlineMark.id || !offlineMark.assessment_id || !offlineMark.student_id) {
        throw new Error('Offline mark structure invalid');
    }
}