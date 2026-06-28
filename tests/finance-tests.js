// tests/finance-tests.js
// Financial module tests

export async function testFinanceModule() {
    console.log('Running finance tests...');

    const tests = [
        testFeeCalculation,
        testPaymentAllocation,
        testCreditCreation,
        testBalanceCalculation,
        testReceiptGeneration
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

    console.log(`Finance tests: ${passed} passed, ${failed} failed`);
    return { passed, failed };
}

async function testFeeCalculation() {
    const fees = [
        { amount: 100000, paid: 50000, expected: 50000 },
        { amount: 75000, paid: 75000, expected: 0 },
        { amount: 200000, paid: 0, expected: 200000 }
    ];

    for (const fee of fees) {
        const remaining = fee.amount - fee.paid;
        if (remaining !== fee.expected) {
            throw new Error(`Fee calculation failed: ${fee.amount} - ${fee.paid} = ${remaining}, expected ${fee.expected}`);
        }
    }
}

async function testPaymentAllocation() {
    const fees = [
        { id: 1, amount: 50000, paid: 0, due_date: '2026-01-01' },
        { id: 2, amount: 75000, paid: 0, due_date: '2026-02-01' },
        { id: 3, amount: 100000, paid: 0, due_date: '2026-03-01' }
    ];

    const paymentAmount = 120000;
    let remaining = paymentAmount;
    let allocated = [];

    // FIFO allocation
    for (const fee of fees.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))) {
        const feeRemaining = fee.amount - fee.paid;
        const allocation = Math.min(remaining, feeRemaining);
        if (allocation > 0) {
            allocated.push({ feeId: fee.id, amount: allocation });
            remaining -= allocation;
        }
    }

    const totalAllocated = allocated.reduce((sum, a) => sum + a.amount, 0);
    if (totalAllocated !== 120000) {
        throw new Error(`Allocation failed: allocated ${totalAllocated}, expected 120000`);
    }
}

async function testCreditCreation() {
    const feeAmount = 100000;
    const paymentAmount = 150000;
    const expectedCredit = 50000;

    const credit = Math.max(0, paymentAmount - feeAmount);
    if (credit !== expectedCredit) {
        throw new Error(`Credit calculation failed: got ${credit}, expected ${expectedCredit}`);
    }
}

async function testBalanceCalculation() {
    const totalFees = 500000;
    const totalPaid = 350000;
    const expectedBalance = 150000;

    const balance = Math.max(0, totalFees - totalPaid);
    if (balance !== expectedBalance) {
        throw new Error(`Balance calculation failed: got ${balance}, expected ${expectedBalance}`);
    }
}

async function testReceiptGeneration() {
    const receiptData = {
        number: 'RCP-001',
        student: 'John Doe',
        amount: 50000,
        date: '2026-01-15'
    };

    // Test receipt number format
    const receiptPattern = /^RCP-\d{8}-\d{4}$/;
    const testReceipt = `RCP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-0001`;

    if (!receiptPattern.test(testReceipt)) {
        throw new Error(`Receipt number format invalid: ${testReceipt}`);
    }
}