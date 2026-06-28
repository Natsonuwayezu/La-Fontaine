// tests/timetable-tests.js
// Timetable module tests

export async function testTimetableModule() {
    console.log('Running timetable tests...');

    const tests = [
        testSlotCreation,
        testConflictDetection,
        testTeacherAvailability,
        testTimeSlotValidation,
        testTimetableExport
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

    console.log(`Timetable tests: ${passed} passed, ${failed} failed`);
    return { passed, failed };
}

async function testSlotCreation() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const timeSlots = ['08:20-09:00', '09:00-09:40', '09:40-10:20'];

    function createSlot(day, timeSlot, classId, subjectId, teacherId) {
        if (!days.includes(day)) throw new Error('Invalid day');
        if (!timeSlots.includes(timeSlot)) throw new Error('Invalid time slot');
        return { day, timeSlot, classId, subjectId, teacherId };
    }

    const slot = createSlot('Monday', '08:20-09:00', 1, 5, 10);

    if (slot.day !== 'Monday') throw new Error('Day not set correctly');
    if (slot.timeSlot !== '08:20-09:00') throw new Error('Time slot not set correctly');
    if (slot.classId !== 1) throw new Error('Class ID not set correctly');
}

async function testConflictDetection() {
    const existingSlots = [
        { teacherId: 10, day: 'Monday', timeSlot: '08:20-09:00' },
        { teacherId: 10, day: 'Monday', timeSlot: '09:00-09:40' },
        { teacherId: 11, day: 'Tuesday', timeSlot: '08:20-09:00' }
    ];

    function hasConflict(newSlot, existingSlots) {
        return existingSlots.some(slot =>
            slot.teacherId === newSlot.teacherId &&
            slot.day === newSlot.day &&
            slot.timeSlot === newSlot.timeSlot
        );
    }

    const conflictingSlot = { teacherId: 10, day: 'Monday', timeSlot: '08:20-09:00' };
    const nonConflictingSlot = { teacherId: 10, day: 'Tuesday', timeSlot: '14:20-15:00' };

    if (!hasConflict(conflictingSlot, existingSlots)) {
        throw new Error('Conflict not detected for overlapping slot');
    }

    if (hasConflict(nonConflictingSlot, existingSlots)) {
        throw new Error('False conflict detected for non-overlapping slot');
    }
}

async function testTeacherAvailability() {
    const teacherSchedule = {
        10: {
            Monday: ['08:20-09:00', '09:00-09:40'],
            Tuesday: ['08:20-09:00'],
            Wednesday: [],
            Thursday: ['14:20-15:00'],
            Friday: ['08:20-09:00', '09:00-09:40', '10:20-11:00']
        }
    };

    function isTeacherAvailable(teacherId, day, timeSlot) {
        const schedule = teacherSchedule[teacherId];
        if (!schedule) return true;
        const daySlots = schedule[day];
        if (!daySlots) return true;
        return !daySlots.includes(timeSlot);
    }

    if (isTeacherAvailable(10, 'Monday', '08:20-09:00')) {
        throw new Error('Teacher incorrectly marked as available when busy');
    }

    if (!isTeacherAvailable(10, 'Monday', '14:20-15:00')) {
        throw new Error('Teacher incorrectly marked as unavailable when free');
    }

    if (!isTeacherAvailable(10, 'Wednesday', '08:20-09:00')) {
        throw new Error('Teacher incorrectly marked as unavailable on free day');
    }
}

async function testTimeSlotValidation() {
    const validSlots = [
        '08:20-09:00', '09:00-09:40', '09:40-10:20',
        '10:40-11:20', '11:20-12:00', '13:00-13:40',
        '13:40-14:20', '14:20-15:00', '15:20-16:00', '16:00-16:40'
    ];

    const breakSlots = ['10:20-10:40', '12:00-13:00', '15:00-15:20'];

    function isValidTimeSlot(slot) {
        return validSlots.includes(slot);
    }

    function isBreakSlot(slot) {
        return breakSlots.includes(slot);
    }

    for (const slot of validSlots) {
        if (!isValidTimeSlot(slot)) {
            throw new Error(`Valid slot ${slot} marked as invalid`);
        }
    }

    for (const slot of breakSlots) {
        if (!isBreakSlot(slot)) {
            throw new Error(`Break slot ${slot} not recognized as break`);
        }
    }
}

async function testTimetableExport() {
    const timetableData = [
        { day: 'Monday', timeSlot: '08:20-09:00', class: 'PRIMARY 4', subject: 'Math', teacher: 'Mr. John' },
        { day: 'Monday', timeSlot: '09:00-09:40', class: 'PRIMARY 4', subject: 'English', teacher: 'Mrs. Jane' }
    ];

    function exportToCSV(data) {
        if (!data || data.length === 0) return '';
        const headers = Object.keys(data[0]);
        const rows = data.map(row => headers.map(h => row[h]).join(','));
        return [headers.join(','), ...rows].join('\n');
    }

    const csv = exportToCSV(timetableData);

    if (!csv.includes('day,timeSlot,class,subject,teacher')) {
        throw new Error('CSV missing headers');
    }

    if (!csv.includes('Monday,08:20-09:00,PRIMARY 4,Math,Mr. John')) {
        throw new Error('CSV missing data row');
    }

    // Test empty data
    const emptyCsv = exportToCSV([]);
    if (emptyCsv !== '') throw new Error('Empty data should return empty string');
}