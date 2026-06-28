// ============================================================
// SYNC ENGINE - Synchronize offline data with server
// ============================================================

import { getUnsyncedOfflineMarks, deleteOfflineMarks, markOfflineMarksSynced, updatePendingBadge } from './offline-engine.js';
import { insert, update, getAll } from './supabase-client.js';
import { getCurrentUser } from './auth.js';
import { showToast } from './helpers.js';
import { info, error as logError } from './logger.js';
import { refreshTable } from './data-loader.js';

let isSyncing = false;

// Sync offline marks to server
export async function syncOfflineMarks() {
    if (!navigator.onLine) {
        showToast('No internet connection. Cannot sync.', 'warning');
        return { success: false, message: 'No internet connection' };
    }

    if (isSyncing) {
        showToast('Sync already in progress...', 'info');
        return { success: false, message: 'Sync already in progress' };
    }

    const unsynced = await getUnsyncedOfflineMarks();
    if (unsynced.length === 0) {
        showToast('No pending marks to sync', 'success');
        return { success: true, message: 'No pending marks' };
    }

    isSyncing = true;
    showSyncProgressModal(unsynced.length);

    let syncedIds = [];
    let failedIds = [];
    let current = 0;

    for (const offlineMark of unsynced) {
        updateSyncProgress(current + 1, unsynced.length, offlineMark);

        try {
            const data = offlineMark.data || offlineMark.marks;
            if (!data || !data.marks || !data.marks.length) {
                failedIds.push(offlineMark.id);
                current++;
                continue;
            }

            // Create assessment if needed
            let assessmentId = offlineMark.assessment_id;
            if (!assessmentId) {
                const assessment = await insert('assessments', {
                    class_id: data.classId,
                    subject_id: data.subjectId,
                    assessment_type: data.assessmentType,
                    assessment_name: data.assessmentName,
                    max_marks: data.maxMarks,
                    due_date: data.dueDate || null,
                    recorded_at: new Date().toISOString().split('T')[0],
                    is_locked: false,
                    created_by: getCurrentUser()?.id || null
                });
                assessmentId = assessment?.id;
            }

            if (!assessmentId) {
                failedIds.push(offlineMark.id);
                current++;
                continue;
            }

            // Save marks to server
            for (const studentMark of data.marks) {
                const existing = await getAll('marks', {
                    assessment_id: assessmentId,
                    student_id: studentMark.student_id
                });

                if (existing.length > 0) {
                    await update('marks', existing[0].id, { score: studentMark.score });
                } else {
                    await insert('marks', {
                        assessment_id: assessmentId,
                        student_id: studentMark.student_id,
                        score: studentMark.score,
                        entered_by: getCurrentUser()?.id || null,
                        entered_at: new Date().toISOString()
                    });
                }
            }

            await markOfflineMarksSynced(offlineMark.id);
            syncedIds.push(offlineMark.id);
        } catch (error) {
            logError('Sync error for offline mark:', error, 'sync-engine');
            failedIds.push(offlineMark.id);
        }
        current++;
    }

    // Delete successfully synced marks
    for (const id of syncedIds) {
        await deleteOfflineMarks(id).catch(console.error);
    }

    await updatePendingBadge();
    await refreshTable('marks');
    await refreshTable('assessments');

    closeSyncModal();

    if (failedIds.length === 0) {
        showToast(`✅ Successfully synced ${syncedIds.length} marks`, 'success');
    } else {
        showToast(`⚠️ Synced ${syncedIds.length} marks, ${failedIds.length} failed`, 'warning');
    }

    isSyncing = false;

    return {
        success: failedIds.length === 0,
        syncedCount: syncedIds.length,
        failedCount: failedIds.length,
        message: `Synced ${syncedIds.length} marks, ${failedIds.length} failed`
    };
}

// Show sync progress modal
export function showSyncProgressModal(total, current = 0, currentItem = null) {
    const modalHtml = `
        <div class="modal-overlay" id="sync-modal" onclick="if(event.target===this)closeSyncModal()">
            <div class="modal modal-sm" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>📱 Syncing Offline Marks</h3>
                    <button class="modal-close" onclick="closeSyncModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div id="sync-status" style="text-align:center;margin-bottom:16px;">
                        <div class="spinner" style="margin:0 auto 12px;"></div>
                        <p id="sync-message">Preparing to sync...</p>
                    </div>
                    <div id="sync-progress-container" style="margin:16px 0;">
                        <div style="background:var(--border-light);border-radius:99px;height:8px;overflow:hidden;">
                            <div id="sync-progress-bar" style="width:0%;height:100%;background:var(--role-primary);transition:width .3s ease;"></div>
                        </div>
                        <p id="sync-progress-text" style="font-size:12px;color:var(--text-muted);margin-top:8px;text-align:center;">0/${total} marks</p>
                    </div>
                    <div id="sync-details" style="font-size:11px;color:var(--text-muted);text-align:center;"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeSyncModal()">Cancel</button>
                </div>
            </div>
        </div>
    `;

    const container = document.getElementById('modals-container');
    if (container) container.innerHTML = modalHtml;

    if (current > 0) {
        updateSyncProgress(current, total, currentItem);
    }
}

// Update sync progress
export function updateSyncProgress(current, total, currentItem) {
    const percent = (current / total) * 100;
    const progressBar = document.getElementById('sync-progress-bar');
    const progressText = document.getElementById('sync-progress-text');
    const messageEl = document.getElementById('sync-message');
    const detailsEl = document.getElementById('sync-details');

    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${current}/${total} marks`;
    if (messageEl) messageEl.textContent = `Syncing mark ${current} of ${total}...`;

    if (currentItem && detailsEl) {
        const data = currentItem.data || currentItem.marks;
        if (data) {
            detailsEl.innerHTML = `Currently syncing: ${data.assessmentName || 'Assessment'} - ${data.marks?.length || 0} marks`;
        }
    }
}

// Close sync modal
export function closeSyncModal() {
    const modal = document.getElementById('sync-modal');
    if (modal) modal.remove();
}

// Auto-sync when coming online
export function initAutoSync() {
    window.addEventListener('online', () => {
        info('Connection restored, auto-syncing...', null, 'sync-engine');
        setTimeout(() => syncOfflineMarks(), 1000);
    });
}