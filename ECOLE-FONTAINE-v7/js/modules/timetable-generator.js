// js/modules/timetable-generator.js
// Timetable Generator Module - Auto-generate timetable from teacher assignments

import { state } from '../core/state.js';
import { getAll, insert, update, remove, removeWhere } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtDate, esc, exportToExcel } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
import { getClassById, getSubjectById, getTeacherById } from './student-fees.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TEACHING_SLOTS = [
    '08:20-09:00', '09:00-09:40', '09:40-10:20',
    '10:40-11:20', '11:20-12:00',
    '13:00-13:40', '13:40-14:20', '14:20-15:00',
    '15:20-16:00', '16:00-16:40'
];

export async function renderTimetableGenerator(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    const classes = state.classes.filter(c => c.is_active !== false);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🤖 Auto Timetable Generator</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="window.generateForAllClasses()">📚 Generate for All Classes</button>
                    <button class="btn btn-sm btn-outline" onclick="window.previewGeneration()">👁️ Preview</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="alert alert-info">
                    <strong>How it works:</strong> The generator uses teacher assignments to automatically create a timetable.
                    It attempts to balance teacher workload and avoid conflicts.
                </div>
                
                <div class="form-grid" style="margin-bottom:20px">
                    <div class="form-group">
                        <label>Select Class</label>
                        <select id="gen-class" class="form-control">
                            <option value="">-- Select Class --</option>
                            ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Generation Mode</label>
                        <select id="gen-mode" class="form-control">
                            <option value="balanced">Balanced (Spread Workload)</option>
                            <option value="compact">Compact (Fewer Days)</option>
                            <option value="morning">Morning Focus</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Existing Slots</label>
                        <select id="gen-existing" class="form-control">
                            <option value="skip">Skip Existing Slots</option>
                            <option value="replace">Replace Existing Slots</option>
                            <option value="clear">Clear All First</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="gen-respect-breaks" checked> Respect Break Times</label>
                    </div>
                </div>
                
                <div class="btn-group">
                    <button class="btn btn-success" onclick="window.generateTimetable()">⚙️ Generate Timetable</button>
                    <button class="btn btn-outline" onclick="window.clearGeneratedTimetable()">🗑️ Clear Generated Slots</button>
                </div>
                
                <div id="generation-result" style="margin-top:20px; display:none" class="alert"></div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📋 Generation Log</span>
            </div>
            <div class="dash-card-body">
                <div id="generation-log" class="table-wrapper" style="max-height:300px; overflow-y:auto">
                    <div style="text-align:center;padding:40px;color:var(--text-muted)">No generation attempts yet</div>
                </div>
            </div>
        </div>
    `;

    window.generateForAllClasses = generateForAllClasses;
    window.previewGeneration = previewGeneration;
    window.generateTimetable = generateTimetable;
    window.clearGeneratedTimetable = clearGeneratedTimetable;

    window._generationLog = [];
}

async function generateForAllClasses() {
    const classes = state.classes.filter(c => c.is_active !== false);
    const mode = document.getElementById('gen-mode')?.value;
    const existingAction = document.getElementById('gen-existing')?.value;
    const respectBreaks = document.getElementById('gen-respect-breaks')?.checked;

    if (!await confirmDialog(`Generate timetable for ALL ${classes.length} classes? This may take a moment.`)) return;

    let totalGenerated = 0;
    let totalErrors = 0;
    const logEntries = [];

    for (const cls of classes) {
        try {
            const result = await generateSingleClassTimetable(cls.id, mode, existingAction, respectBreaks, true);
            totalGenerated += result.generated;
            logEntries.push({
                class: cls.name,
                generated: result.generated,
                existing: result.existing,
                status: 'success'
            });
        } catch (e) {
            totalErrors++;
            logEntries.push({
                class: cls.name,
                error: e.message,
                status: 'error'
            });
        }
    }

    const logHtml = logEntries.map(entry => `
        <div style="padding:8px; border-bottom:1px solid var(--border-light); display:flex; justify-content:space-between">
            <span><strong>${esc(entry.class)}</strong></span>
            <span class="badge ${entry.status === 'success' ? 'badge-success' : 'badge-danger'}">
                ${entry.status === 'success' ? `✅ Generated ${entry.generated} slots` : `❌ ${entry.error}`}
            </span>
        </div>
    `).join('');

    const logContainer = document.getElementById('generation-log');
    if (logContainer) {
        logContainer.innerHTML = `
            <div style="padding:8px; background:var(--bg-tertiary); font-weight:700">
                Generated for ${classes.length} classes: ${totalGenerated} total slots (${totalErrors} errors)
            </div>
            ${logHtml}
        `;
    }

    showToast(`✅ Generated ${totalGenerated} slots across ${classes.length - totalErrors} classes`, 'success');
}

async function previewGeneration() {
    const classId = document.getElementById('gen-class')?.value;
    if (!classId) {
        showToast('Please select a class', 'warning');
        return;
    }

    const mode = document.getElementById('gen-mode')?.value;
    const respectBreaks = document.getElementById('gen-respect-breaks')?.checked;

    const preview = await generateSingleClassTimetable(classId, mode, 'skip', respectBreaks, true);

    showModal(`
        <div class="modal-overlay">
            <div class="modal modal-lg" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>👁️ Generation Preview - ${esc(getClassById(parseInt(classId))?.name)}</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info">
                        <strong>Preview Results:</strong><br>
                        Would generate ${preview.generated} slots (${preview.existing} existing would be kept)
                    </div>
                    <div class="table-wrapper" style="max-height:400px; overflow-y:auto">
                        <table class="data-table">
                            <thead>
                                <tr><th>Day</th><th>Time Slot</th><th>Subject</th><th>Teacher</th></tr>
                            </thead>
                            <tbody>
                                ${preview.previewSlots?.map(slot => `
                                    <tr>
                                        <td>${slot.day}</span>
                                        <td>${slot.timeSlot}</span>
                                        <td>${esc(slot.subjectName)}</span>
                                        <td>${esc(slot.teacherName)}</span>
                                    </tr>
                                `).join('') || '<tr><td colspan="4" style="text-align:center">No slots generated</span>'}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="closeModal(); generateTimetable()">✅ Generate Now</button>
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                </div>
            </div>
        </div>
    `);
}

async function generateTimetable() {
    const classId = document.getElementById('gen-class')?.value;
    const mode = document.getElementById('gen-mode')?.value;
    const existingAction = document.getElementById('gen-existing')?.value;
    const respectBreaks = document.getElementById('gen-respect-breaks')?.checked;

    if (!classId) {
        showToast('Please select a class', 'warning');
        return;
    }

    const result = await generateSingleClassTimetable(classId, mode, existingAction, respectBreaks, false);

    const resultDiv = document.getElementById('generation-result');
    if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.className = `alert ${result.errors > 0 ? 'alert-warning' : 'alert-success'}`;
        resultDiv.innerHTML = `
            <strong>✅ Generation Complete!</strong><br>
            Generated: ${result.generated} slots<br>
            Existing kept: ${result.existing}<br>
            Errors: ${result.errors}<br>
            ${result.warnings ? `<span style="color:var(--warning)">⚠️ ${result.warnings}</span>` : ''}
        `;
    }

    // Add to log
    const cls = getClassById(parseInt(classId));
    const logEntry = `
        <div style="padding:8px; border-bottom:1px solid var(--border-light); display:flex; justify-content:space-between">
            <span><strong>${esc(cls?.name)}</strong> - ${new Date().toLocaleTimeString()}</span>
            <span class="badge badge-success">✅ Generated ${result.generated} slots</span>
        </div>
    `;
    const logContainer = document.getElementById('generation-log');
    if (logContainer) {
        if (logContainer.innerHTML.includes('No generation attempts')) {
            logContainer.innerHTML = logEntry;
        } else {
            logContainer.innerHTML = logEntry + logContainer.innerHTML;
        }
    }

    showToast(`✅ Generated ${result.generated} timetable slots for ${cls?.name}`, 'success');
    await refreshTable('timetable_slots');
}

async function generateSingleClassTimetable(classId, mode, existingAction, respectBreaks, isPreview = false) {
    const cls = getClassById(classId);
    if (!cls) return { generated: 0, existing: 0, errors: 0, warnings: '' };

    // Get teacher assignments for this class
    const assignments = await getAll('teacher_assignments', { class_id: classId });
    if (assignments.length === 0) {
        return { generated: 0, existing: 0, errors: 1, warnings: 'No teacher assignments found for this class' };
    }

    // Get existing slots
    let existingSlots = [];
    if (existingAction !== 'clear') {
        existingSlots = await getAll('timetable_slots', { class_id: classId });
    }

    if (existingAction === 'clear') {
        if (!isPreview) await removeWhere('timetable_slots', `class_id=eq.${classId}`);
        existingSlots = [];
    } else if (existingAction === 'replace') {
        if (!isPreview) await removeWhere('timetable_slots', `class_id=eq.${classId}`);
        existingSlots = [];
    }

    // Track teacher availability to avoid conflicts
    const teacherSchedule = new Map(); // teacherId -> Set of "day|timeSlot"
    for (const slot of existingSlots) {
        if (slot.teacher_id) {
            if (!teacherSchedule.has(slot.teacher_id)) teacherSchedule.set(slot.teacher_id, new Set());
            teacherSchedule.get(slot.teacher_id).add(`${slot.day}|${slot.time_slot}`);
        }
    }

    // Determine available time slots based on mode
    let availableSlots = [...TEACHING_SLOTS];
    if (mode === 'compact') {
        availableSlots = TEACHING_SLOTS.slice(0, 6);
    } else if (mode === 'morning') {
        availableSlots = TEACHING_SLOTS.slice(0, 5);
    }

    // Schedule assignments
    const newSlots = [];
    const previewSlots = [];
    let scheduled = 0;
    let conflicts = 0;

    // Shuffle assignments to distribute workload
    const shuffledAssignments = [...assignments];
    for (let i = shuffledAssignments.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledAssignments[i], shuffledAssignments[j]] = [shuffledAssignments[j], shuffledAssignments[i]];
    }

    for (const assignment of shuffledAssignments) {
        let placed = false;
        // Try to place each assignment
        for (const day of DAYS) {
            if (placed) break;
            for (const timeSlot of availableSlots) {
                // Check if this slot is available for the teacher
                if (teacherSchedule.has(assignment.teacher_id) &&
                    teacherSchedule.get(assignment.teacher_id).has(`${day}|${timeSlot}`)) {
                    conflicts++;
                    continue;
                }

                // Check if this slot is already taken for this class
                const classSlotTaken = existingSlots.some(s => s.day === day && s.time_slot === timeSlot);
                if (classSlotTaken) continue;

                // Found available slot
                if (!isPreview) {
                    await insert('timetable_slots', {
                        class_id: classId,
                        subject_id: assignment.subject_id,
                        teacher_id: assignment.teacher_id,
                        day: day,
                        time_slot: timeSlot,
                        created_at: new Date().toISOString()
                    });
                }

                // Mark as used
                if (!teacherSchedule.has(assignment.teacher_id)) teacherSchedule.set(assignment.teacher_id, new Set());
                teacherSchedule.get(assignment.teacher_id).add(`${day}|${timeSlot}`);

                const subject = getSubjectById(assignment.subject_id);
                const teacher = getTeacherById(assignment.teacher_id);

                previewSlots.push({
                    day, timeSlot,
                    subjectName: subject?.name || 'Unknown',
                    teacherName: teacher?.name || 'Unknown'
                });

                scheduled++;
                placed = true;
                break;
            }
        }
    }

    const warnings = conflicts > 0 ? `${conflicts} teacher conflicts avoided by using alternative slots` : '';

    return {
        generated: scheduled,
        existing: existingSlots.length,
        errors: 0,
        warnings: warnings,
        previewSlots: previewSlots
    };
}

async function clearGeneratedTimetable() {
    const classId = document.getElementById('gen-class')?.value;
    if (!classId) {
        showToast('Please select a class', 'warning');
        return;
    }

    const cls = getClassById(parseInt(classId));
    if (!await confirmDialog(`Clear ALL timetable slots for ${cls?.name}? This action cannot be undone.`)) return;

    await removeWhere('timetable_slots', `class_id=eq.${classId}`);
    await refreshTable('timetable_slots');
    showToast(`✅ Cleared all timetable slots for ${cls?.name}`, 'success');

    const resultDiv = document.getElementById('generation-result');
    if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.className = 'alert alert-info';
        resultDiv.innerHTML = `<strong>🗑️ Cleared</strong> All timetable slots for ${cls?.name} have been removed.`;
    }
}