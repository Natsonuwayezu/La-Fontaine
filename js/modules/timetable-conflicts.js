// js/modules/timetable-conflicts.js
// Timetable Conflicts Module - Detect and resolve timetable conflicts


async function renderTimetableConflicts(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">⚠️ Timetable Conflict Detector</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="window.detectAllConflicts()">🔍 Detect Conflicts</button>
                    <button class="btn btn-sm btn-outline" onclick="window.exportConflictReport()">📥 Export Report</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="alert alert-info">
                    <strong>Conflict Types:</strong>
                    <ul style="margin-top:8px; margin-left:20px">
                        <li><strong>Teacher Conflict:</strong> Same teacher assigned to two different classes at the same time</li>
                        <li><strong>Classroom Conflict:</strong> Same classroom assigned to two different classes at the same time</li>
                        <li><strong>Teacher Overload:</strong> Teacher has more than 8 periods in a single day</li>
                    </ul>
                </div>
                
                <div class="filters-bar">
                    <select id="conflict-type-filter" class="form-control" style="width:150px" onchange="window.filterConflicts()">
                        <option value="all">All Conflicts</option>
                        <option value="teacher">Teacher Conflicts</option>
                        <option value="classroom">Classroom Conflicts</option>
                        <option value="overload">Teacher Overload</option>
                    </select>
                    <span class="result-count" id="conflict-count"></span>
                </div>
                
                <div id="conflicts-container" class="table-wrapper">
                    <div class="loading-container"><div class="spinner"></div><p>Click "Detect Conflicts" to start analysis</p></div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Conflict Statistics</span>
            </div>
            <div class="dash-card-body">
                <div id="conflict-stats" class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                    <div class="loading-container"><div class="spinner"></div><p>Run detection to see stats</p></div>
                </div>
            </div>
        </div>
    `;

    window.detectAllConflicts = detectAllConflicts;
    window.exportConflictReport = exportConflictReport;
    window.filterConflicts = filterConflicts;
    window.resolveConflict = resolveConflict;

    window._currentConflicts = [];
}

async function detectAllConflicts() {
    const container = document.getElementById('conflicts-container');
    const statsContainer = document.getElementById('conflict-stats');

    container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Analyzing timetable for conflicts...</p></div>';

    try {
        const slots = await getAll('timetable_slots');
        const conflicts = [];

        // 1. Teacher conflicts (same teacher, same day, same time)
        const teacherSlotMap = new Map();
        for (const slot of slots) {
            if (!slot.teacher_id) continue;
            const key = `${slot.teacher_id}|${slot.day}|${slot.time_slot}`;
            if (!teacherSlotMap.has(key)) teacherSlotMap.set(key, []);
            teacherSlotMap.get(key).push(slot);
        }

        for (const [key, conflictSlots] of teacherSlotMap.entries()) {
            if (conflictSlots.length > 1) {
                const [teacherId, day, timeSlot] = key.split('|');
                conflicts.push({
                    type: 'teacher',
                    severity: 'high',
                    teacherId: parseInt(teacherId),
                    teacherName: getTeacherById(parseInt(teacherId))?.name || `Teacher #${teacherId}`,
                    day: day,
                    timeSlot: timeSlot,
                    slots: conflictSlots,
                    message: `${conflictSlots.length} classes at the same time`
                });
            }
        }

        // 2. Classroom conflicts (same room, same day, same time)
        const roomSlotMap = new Map();
        for (const slot of slots) {
            if (!slot.room) continue;
            const key = `${slot.room}|${slot.day}|${slot.time_slot}`;
            if (!roomSlotMap.has(key)) roomSlotMap.set(key, []);
            roomSlotMap.get(key).push(slot);
        }

        for (const [key, conflictSlots] of roomSlotMap.entries()) {
            if (conflictSlots.length > 1) {
                const [room, day, timeSlot] = key.split('|');
                conflicts.push({
                    type: 'classroom',
                    severity: 'high',
                    room: room,
                    day: day,
                    timeSlot: timeSlot,
                    slots: conflictSlots,
                    message: `Room ${room} has ${conflictSlots.length} classes at the same time`
                });
            }
        }

        // 3. Teacher overload (more than 8 periods per day)
        const teacherDailyCount = new Map();
        for (const slot of slots) {
            if (!slot.teacher_id) continue;
            const key = `${slot.teacher_id}|${slot.day}`;
            teacherDailyCount.set(key, (teacherDailyCount.get(key) || 0) + 1);
        }

        for (const [key, count] of teacherDailyCount.entries()) {
            if (count > 8) {
                const [teacherId, day] = key.split('|');
                conflicts.push({
                    type: 'overload',
                    severity: 'medium',
                    teacherId: parseInt(teacherId),
                    teacherName: getTeacherById(parseInt(teacherId))?.name || `Teacher #${teacherId}`,
                    day: day,
                    periodCount: count,
                    message: `${count} periods in one day (recommended max 8)`
                });
            }
        }

        window._currentConflicts = conflicts;
        renderConflicts(conflicts);
        renderConflictStats(conflicts);

        if (conflicts.length === 0) {
            showToast('✅ No conflicts found! Timetable is clean.', 'success');
        } else {
            showToast(`⚠️ Found ${conflicts.length} conflict(s)`, 'warning');
        }

    } catch (e) {
        console.error('Conflict detection error:', e);
        container.innerHTML = `<div class="alert alert-danger">Error detecting conflicts: ${esc(e.message)}</div>`;
    }
}

function renderConflicts(conflicts) {
    const container = document.getElementById('conflicts-container');
    const countSpan = document.getElementById('conflict-count');

    if (countSpan) countSpan.textContent = `${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''}`;

    if (conflicts.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted)">✅ No conflicts detected. Timetable is clean!</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Details</th>
                    <th>Affected Items</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${conflicts.map((conflict, idx) => {
        const severityClass = conflict.severity === 'high' ? 'badge-danger' : 'badge-warning';
        const severityIcon = conflict.severity === 'high' ? '🔴' : '🟡';
        const typeIcon = conflict.type === 'teacher' ? '👩‍🏫' : (conflict.type === 'classroom' ? '🏠' : '📊');

        let detailsHtml = '';
        if (conflict.type === 'teacher') {
            detailsHtml = `
                            <div><strong>Teacher:</strong> ${esc(conflict.teacherName)}</div>
                            <div><strong>Day:</strong> ${conflict.day}</div>
                            <div><strong>Time:</strong> ${conflict.timeSlot}</div>
                            <div><strong>Classes:</strong> ${conflict.slots.map(s => getClassById(s.class_id)?.name).join(', ')}</div>
                        `;
        } else if (conflict.type === 'classroom') {
            detailsHtml = `
                            <div><strong>Room:</strong> ${esc(conflict.room)}</div>
                            <div><strong>Day:</strong> ${conflict.day}</div>
                            <div><strong>Time:</strong> ${conflict.timeSlot}</div>
                            <div><strong>Classes:</strong> ${conflict.slots.map(s => getClassById(s.class_id)?.name).join(', ')}</div>
                        `;
        } else {
            detailsHtml = `
                            <div><strong>Teacher:</strong> ${esc(conflict.teacherName)}</div>
                            <div><strong>Day:</strong> ${conflict.day}</div>
                            <div><strong>Periods:</strong> ${conflict.periodCount} periods</div>
                        `;
        }

        return `
                        <tr>
                            <td style="text-align:center"><span class="badge badge-info">${typeIcon} ${conflict.type}</span></span>
                            <td style="text-align:center"><span class="badge ${severityClass}">${severityIcon} ${conflict.severity}</span></span>
                            <td>${conflict.message}</span>
                            <td>${detailsHtml}</span>
                            <td style="text-align:center">
                                <button class="btn btn-sm btn-primary" onclick="window.resolveConflict(${idx})">🔧 Resolve</button>
                            </span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

function renderConflictStats(conflicts) {
    const container = document.getElementById('conflict-stats');
    if (!container) return;

    const teacherConflicts = conflicts.filter(c => c.type === 'teacher').length;
    const classroomConflicts = conflicts.filter(c => c.type === 'classroom').length;
    const overloadConflicts = conflicts.filter(c => c.type === 'overload').length;
    const highSeverity = conflicts.filter(c => c.severity === 'high').length;

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon">👩‍🏫</div>
            <div class="stat-value">${teacherConflicts}</div>
            <div class="stat-label">Teacher Conflicts</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">🏠</div>
            <div class="stat-value">${classroomConflicts}</div>
            <div class="stat-label">Classroom Conflicts</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-value">${overloadConflicts}</div>
            <div class="stat-label">Teacher Overloads</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">🔴</div>
            <div class="stat-value">${highSeverity}</div>
            <div class="stat-label">High Severity</div>
        </div>
    `;
}

function filterConflicts() {
    const filter = document.getElementById('conflict-type-filter')?.value;
    let filtered = window._currentConflicts || [];

    if (filter !== 'all') {
        filtered = filtered.filter(c => c.type === filter);
    }

    renderConflicts(filtered);
}

async function resolveConflict(conflictIndex) {
    const conflict = window._currentConflicts[conflictIndex];
    if (!conflict) return;

    if (conflict.type === 'teacher') {
        // Show resolution modal for teacher conflict
        showConflictResolutionModal(conflict);
    } else if (conflict.type === 'classroom') {
        showClassroomConflictModal(conflict);
    } else if (conflict.type === 'overload') {
        showOverloadResolutionModal(conflict);
    }
}

function showConflictResolutionModal(conflict) {
    const slots = conflict.slots;
    const options = slots.map((slot, idx) => {
        const cls = getClassById(slot.class_id);
        const subj = getSubjectById(slot.subject_id);
        return `
            <div style="border:1px solid var(--border-light); border-radius:8px; padding:12px; margin-bottom:8px">
                <strong>Option ${idx + 1}:</strong> ${esc(cls?.name)} - ${esc(subj?.name)}<br>
                <button class="btn btn-sm btn-outline" onclick="window.moveSlotToNewTime(${slot.id}, ${conflictIndex})">⏰ Move to Different Time</button>
                <button class="btn btn-sm btn-outline" onclick="window.assignDifferentTeacher(${slot.id}, ${conflictIndex})">👩‍🏫 Assign Different Teacher</button>
            </div>
        `;
    }).join('');

    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>🔧 Resolve Teacher Conflict</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-warning">
                        <strong>Conflict:</strong> Teacher ${esc(conflict.teacherName)} is scheduled for multiple classes at ${conflict.day} ${conflict.timeSlot}
                    </div>
                    <h4>Choose action for one of these classes:</h4>
                    ${options}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                </div>
            </div>
        </div>
    `);

    window.moveSlotToNewTime = async (slotId, conflictIdx) => {
        closeModal();
        const newTime = prompt('Enter new time slot (e.g., Monday|08:20-09:00):', '');
        if (newTime && newTime.includes('|')) {
            const [newDay, newTimeSlot] = newTime.split('|');
            await update('timetable_slots', slotId, { day: newDay, time_slot: newTimeSlot });
            showToast('✅ Slot moved. Re-run conflict detection to verify.', 'success');
            setTimeout(() => detectAllConflicts(), 500);
        }
    };

    window.assignDifferentTeacher = async (slotId, conflictIdx) => {
        closeModal();
        const teachers = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false);
        const teacherList = teachers.map(t => `${t.id}|${t.name}`).join(',');
        const newTeacherId = prompt(`Enter new teacher ID from list:\n${teacherList}`, '');
        if (newTeacherId) {
            await update('timetable_slots', slotId, { teacher_id: parseInt(newTeacherId) });
            showToast('✅ Teacher reassigned. Re-run conflict detection to verify.', 'success');
            setTimeout(() => detectAllConflicts(), 500);
        }
    };
}

function showClassroomConflictModal(conflict) {
    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>🔧 Resolve Classroom Conflict</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-warning">
                        <strong>Conflict:</strong> Room ${esc(conflict.room)} is scheduled for multiple classes at ${conflict.day} ${conflict.timeSlot}
                    </div>
                    <p>To resolve, edit the conflicting slots and assign different rooms or times.</p>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="window.openTimetableEditor(); closeModal()">Open Timetable Editor</button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                </div>
            </div>
        </div>
    `);
}

function showOverloadResolutionModal(conflict) {
    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>🔧 Resolve Teacher Overload</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-warning">
                        <strong>Overload:</strong> ${esc(conflict.teacherName)} has ${conflict.periodCount} periods on ${conflict.day}
                    </div>
                    <p>Consider redistributing some classes to other teachers or moving them to different days.</p>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="window.openTimetableEditor(); closeModal()">Open Timetable Editor</button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                </div>
            </div>
        </div>
    `);
}

window.openTimetableEditor = function () {
    navigateTo('timetable');
};

function exportConflictReport() {
    const conflicts = window._currentConflicts || [];
    const data = conflicts.map(c => ({
        'Type': c.type,
        'Severity': c.severity,
        'Description': c.message,
        'Teacher': c.type === 'teacher' || c.type === 'overload' ? c.teacherName : '',
        'Day': c.day || '',
        'Time Slot': c.timeSlot || '',
        'Room': c.type === 'classroom' ? c.room : ''
    }));

    exportToExcel(data, `Timetable_Conflicts_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Conflict report exported', 'success');
}