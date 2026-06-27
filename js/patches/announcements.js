// ══════════════════════════════════════════════════════════════════════════

        function toggleAnnouncementRecipients() {
            const recipients = document.getElementById('ann-recipients')?.value;
            const specificGroup = document.getElementById('ann-specific-teacher-group');
            if (specificGroup) specificGroup.style.display = recipients === 'specific' ? 'block' : 'none';
        }

        async function viewAnnouncementDetails(id) {
            const a = await getById('announcements', id);
            if (!a) return;
            showModal(`
                <div class="modal-overlay"><div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header"><h3>📢 ${esc(a.title)}</h3>
                        <button class="modal-close" onclick="closeModal()">✕</button></div>
                    <div class="modal-body">
                        <div style="margin-bottom:12px">
                            <span class="badge ${a.type === 'urgent' ? 'badge-danger' : a.type === 'event' ? 'badge-warning' : 'badge-info'}">${esc(a.type || 'general')}</span>
                            <span class="badge badge-neutral">To: ${esc(a.recipients || 'All Users')}</span>
                            <span class="badge badge-neutral">Date: ${fmtDate(a.created_at)}</span>
                        </div>
                        <div style="white-space:pre-wrap;line-height:1.6">${esc(a.message || '')}</div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="closeModal()">Close</button>
                        <button class="btn btn-primary" onclick="editAnnouncement(${id})">✏️ Edit</button>
                    </div>
                </div></div>`);
        }

        async function editAnnouncement(id) {
            closeModal();
            setTimeout(() => { if (window.openSendAnnouncementModal) openSendAnnouncementModal(id); }, 200);
        }

        async function deleteAnnouncementById(id) {
            if (!await confirmDialog('Delete this announcement?')) return;
            await remove('announcements', id);
            showToast('✅ Announcement deleted', 'success');
            renderAnnouncements(document.getElementById('dynamic-content'));
        }

        window.viewAnnouncementDetails = viewAnnouncementDetails;
        window.editAnnouncement = editAnnouncement;
        window.deleteAnnouncementById = deleteAnnouncementById;
        window.toggleAnnouncementRecipients = toggleAnnouncementRecipients;


        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 104 — MISSING MODULE HELPER FUNCTIONS (all 79 restored)
