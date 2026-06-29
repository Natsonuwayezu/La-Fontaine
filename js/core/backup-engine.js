// ============================================================
// BACKUP ENGINE - Full system backup and restore
// ============================================================


const BACKUP_KEY = 'ecole_auto_backups';
const MAX_BACKUPS = 5;

// Create full backup
async function createFullBackup(manual = false) {
    if (!manual && state.currentUser?.role !== 'admin') return null;

    const backup = {
        version: '6.0',
        timestamp: new Date().toISOString(),
        type: manual ? 'manual' : 'auto',
        school: state.schoolSettings,
        students: state.students,
        teachers: state.teachers,
        classes: state.classes,
        subjects: state.subjects,
        terms: state.terms,
        academicYears: state.academicYears,
        assessments: state.assessments,
        marks: state.marks,
        payments: state.payments,
        feeCategories: state.feeCategories,
        feeAmounts: state.feeAmounts,
        studentFees: state.studentFees,
        families: state.families,
        gradingScale: state.gradingScale
    };

    backup.checksum = JSON.stringify(backup).length;

    if (!manual) {
        saveBackupWithRotation(backup);
        localStorage.setItem('elf_last_backup_time', backup.timestamp);
    }

    info(`Backup created: ${manual ? 'manual' : 'auto'}`, { size: backup.checksum }, 'backup-engine');
    return backup;
}

// Save backup with rotation (keep only last MAX_BACKUPS)
function saveBackupWithRotation(backup) {
    let backups = [];
    try {
        backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
    } catch (e) {
        backups = [];
    }

    backups.unshift({
        timestamp: backup.timestamp,
        type: backup.type,
        version: backup.version,
        checksum: backup.checksum,
        records: {
            students: backup.students?.length || 0,
            marks: backup.marks?.length || 0,
            payments: backup.payments?.length || 0
        }
    });

    if (backups.length > MAX_BACKUPS) {
        backups = backups.slice(0, MAX_BACKUPS);
    }

    try {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
        localStorage.setItem('elf_latest_backup', JSON.stringify(backup));
    } catch (e) {
        logError('Backup storage failed', e, 'backup-engine');
    }
}

// Get backup history
function getBackupHistory() {
    try {
        return JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
    } catch (e) {
        return [];
    }
}

// Download backup as JSON file
function downloadBackup(backupData, filename = null) {
    if (!backupData) return;

    const jsonData = JSON.stringify(backupData, null, 2);
    const defaultFilename = `EcoleLaFontaine_Backup_${new Date().toISOString().split('T')[0]}.json`;
    downloadBlob(jsonData, filename || defaultFilename, 'application/json');
    showToast('✅ Backup downloaded', 'success');
}

// Restore from backup data
async function restoreFromBackup(backupData) {
    if (!await confirmDialog('⚠️ RESTORE WARNING: This will replace ALL current data! This cannot be undone. Continue?')) {
        return false;
    }

    showToast('Restoring backup...', 'info');

    try {
        // Clear existing data
        await removeWhere('students', 'id IS NOT NULL');
        await removeWhere('teachers', 'id > 0');
        await removeWhere('classes', 'id IS NOT NULL');
        await removeWhere('subjects', 'id IS NOT NULL');
        await removeWhere('assessments', 'id IS NOT NULL');
        await removeWhere('marks', 'id IS NOT NULL');
        await removeWhere('payments', 'id IS NOT NULL');
        await removeWhere('fee_categories', 'id IS NOT NULL');
        await removeWhere('fee_amounts', 'id IS NOT NULL');
        await removeWhere('student_fees', 'id IS NOT NULL');
        await removeWhere('families', 'id IS NOT NULL');

        // Restore data
        for (const student of (backupData.students || [])) {
            await insert('students', student);
        }
        for (const teacher of (backupData.teachers || [])) {
            await insert('teachers', teacher);
        }
        for (const cls of (backupData.classes || [])) {
            await insert('classes', cls);
        }
        for (const subject of (backupData.subjects || [])) {
            await insert('subjects', subject);
        }
        for (const assessment of (backupData.assessments || [])) {
            await insert('assessments', assessment);
        }
        for (const mark of (backupData.marks || [])) {
            await insert('marks', mark);
        }
        for (const payment of (backupData.payments || [])) {
            await insert('payments', payment);
        }
        for (const feeCategory of (backupData.feeCategories || [])) {
            await insert('fee_categories', feeCategory);
        }
        for (const feeAmount of (backupData.feeAmounts || [])) {
            await insert('fee_amounts', feeAmount);
        }
        for (const studentFee of (backupData.studentFees || [])) {
            await insert('student_fees', studentFee);
        }
        for (const family of (backupData.families || [])) {
            await insert('families', family);
        }

        // Refresh all tables
        await refreshTable('students');
        await refreshTable('teachers');
        await refreshTable('classes');
        await refreshTable('subjects');
        await refreshTable('assessments');
        await refreshTable('marks');
        await refreshTable('payments');
        await refreshTable('fee_categories');
        await refreshTable('fee_amounts');
        await refreshTable('student_fees');
        await refreshTable('families');

        showToast('✅ Restore complete! Reloading...', 'success');
        setTimeout(() => location.reload(), 2000);
        return true;
    } catch (error) {
        logError('Restore failed', error, 'backup-engine');
        showToast('Restore failed: ' + error.message, 'error');
        return false;
    }
}

// Import backup from file
function importBackupFromFile(file) {
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const backupData = JSON.parse(ev.target.result);
            await restoreFromBackup(backupData);
        } catch (e) {
            showToast('Invalid backup file', 'error');
        }
    };
    reader.readAsText(file);
}

// Start auto-backup scheduler
function startAutoBackupScheduler() {
    // Run every 6 hours
    setInterval(async () => {
        if (state.currentUser?.role === 'admin' && navigator.onLine) {
            await createFullBackup(false);
            info('Auto-backup completed', null, 'backup-engine');
        }
    }, 6 * 60 * 60 * 1000);

    // Also run on page load if not done today
    const lastBackup = localStorage.getItem('elf_last_backup_time');
    if (!lastBackup || (Date.now() - new Date(lastBackup).getTime()) > 24 * 60 * 60 * 1000) {
        setTimeout(() => createFullBackup(false), 5000);
    }
}

// Delete backup record from history
function deleteBackupRecord(filename) {
    let backups = getBackupHistory();
    backups = backups.filter(b => b.filename !== filename);
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
    showToast('✅ Backup record deleted', 'success');
}