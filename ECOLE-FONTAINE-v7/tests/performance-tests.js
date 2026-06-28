// tests/performance-tests.js
// Performance benchmark tests

export async function testPerformance() {
    console.log('Running performance tests...');

    const tests = [
        testRenderTime,
        testDataLoading,
        testSearchPerformance,
        testExportPerformance
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            const result = await test();
            console.log(`✅ ${test.name} passed: ${result.time}ms`);
            passed++;
        } catch (error) {
            console.error(`❌ ${test.name} failed:`, error.message);
            failed++;
        }
    }

    console.log(`Performance tests: ${passed} passed, ${failed} failed`);
    return { passed, failed };
}

async function testRenderTime() {
    const startTime = performance.now();

    // Simulate render
    await new Promise(resolve => setTimeout(resolve, 50));

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    const maxAllowed = 200; // 200ms max
    if (renderTime > maxAllowed) {
        throw new Error(`Render time too high: ${renderTime.toFixed(2)}ms > ${maxAllowed}ms`);
    }

    return { time: renderTime.toFixed(2) };
}

async function testDataLoading() {
    const testData = Array(1000).fill().map((_, i) => ({ id: i, name: `Item ${i}` }));

    const startTime = performance.now();

    // Simulate data processing
    const processed = testData.filter(item => item.id % 2 === 0);

    const endTime = performance.now();
    const loadTime = endTime - startTime;

    const maxAllowed = 100; // 100ms max for 1000 items
    if (loadTime > maxAllowed) {
        throw new Error(`Data loading too slow: ${loadTime.toFixed(2)}ms > ${maxAllowed}ms`);
    }

    if (processed.length !== 500) {
        throw new Error(`Data processing incorrect: expected 500, got ${processed.length}`);
    }

    return { time: loadTime.toFixed(2) };
}

async function testSearchPerformance() {
    const testData = Array(5000).fill().map((_, i) => ({
        id: i,
        name: `Student ${i}`,
        code: `STU${String(i).padStart(4, '0')}`
    }));

    const startTime = performance.now();

    // Simulate search
    const query = 'Student 123';
    const results = testData.filter(item =>
        item.name.toLowerCase().includes(query.toLowerCase()) ||
        item.code.toLowerCase().includes(query.toLowerCase())
    );

    const endTime = performance.now();
    const searchTime = endTime - startTime;

    const maxAllowed = 50; // 50ms max
    if (searchTime > maxAllowed) {
        throw new Error(`Search too slow: ${searchTime.toFixed(2)}ms > ${maxAllowed}ms`);
    }

    return { time: searchTime.toFixed(2) };
}

async function testExportPerformance() {
    const testData = Array(2000).fill().map((_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random() * 1000
    }));

    const startTime = performance.now();

    // Simulate CSV generation
    const headers = Object.keys(testData[0]);
    const csvRows = [headers.join(',')];
    for (const row of testData.slice(0, 1000)) {
        csvRows.push(headers.map(h => row[h]).join(','));
    }
    const csv = csvRows.join('\n');

    const endTime = performance.now();
    const exportTime = endTime - startTime;

    const maxAllowed = 500; // 500ms max for 1000 rows
    if (exportTime > maxAllowed) {
        throw new Error(`Export too slow: ${exportTime.toFixed(2)}ms > ${maxAllowed}ms`);
    }

    if (csv.length === 0) {
        throw new Error('Export generated empty data');
    }

    return { time: exportTime.toFixed(2) };
}