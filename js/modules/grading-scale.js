// SECTION 63: GRADING SCALE
        // ================================================================

        async function renderGradingScale(container) {
            if (!isAdmin()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }
            await ensureStateLoaded();

            const grades = state.gradingScale || DEFAULT_GRADES;

            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Grading Scale</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-success" onclick="saveGradingScale()">💾 Save</button>
                    <button class="btn btn-sm btn-outline" onclick="resetGradingScale()">🔄 Reset to Default</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Grade</th>
                                <th>Min %</th>
                                <th>Max %</th>
                                <th>Description</th>
                                <th>Color</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="grading-scale-tbody">
                            ${grades.map((g, i) => `
                                <tr>
                                    <td><input type="text" id="grade-name-${i}" value="${esc(g.grade)}" style="width:70px"></td>
                                    <td><input type="number" id="grade-min-${i}" value="${g.min}" style="width:70px" min="0" max="100"></td>
                                    <td><input type="number" id="grade-max-${i}" value="${g.max}" style="width:70px" min="0" max="100"></td>
                                    <td><input type="text" id="grade-desc-${i}" value="${esc(g.desc || '')}" style="width:120px"></td>
                                    <td><input type="color" id="grade-color-${i}" value="${g.bg === '#d1fae5' ? '#d1fae5' : (g.bg || '#d1fae5')}" style="width:50px"></td>
                                    <td><button class="btn btn-sm btn-danger" onclick="removeGradeLevel(${i})">🗑️</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <button class="btn btn-sm btn-outline" style="margin-top:16px" onclick="addGradeLevel()">➕ Add Grade Level</button>

                <div class="alert alert-info" style="margin-top:20px">
                    <strong>📐 Grade Calculation Formula:</strong><br>
                    Percentage = (Student Score / Assessment Max Marks) × 100<br>
                    Grade = Lookup in table above based on percentage range
                </div>

                <div id="grade-preview" style="margin-top:20px">
                    <h4>Preview Distribution (based on current data)</h4>
                    <div id="grade-distribution-chart" style="height:200px"></div>
                </div>
            </div>
        </div>
    `;

            renderGradeDistributionPreview();
        }
        window.renderGradingScale = renderGradingScale;

        function renderGradeDistributionPreview() {
            const wrapper = document.getElementById('grade-distribution-chart');
            if (!wrapper) return;

            const grades = state.gradingScale || DEFAULT_GRADES;
            const termId = state.currentTerm?.id;
            const counts = grades.map(() => 0);

            for (const student of state.students.filter(s => s.status === 'Active')) {
                const assessments = state.assessments.filter(a => a.class_id === student.class_id && (!termId || a.term_id === termId));
                if (!assessments.length) continue;
                let total = 0, max = 0;
                for (const a of assessments) {
                    const mark = state.marks.find(m => m.assessment_id === a.id && m.student_id === student.id);
                    if (mark) { total += mark.score; max += a.max_marks; }
                }
                if (max === 0) continue;
                const pct = (total / max) * 100;
                const idx = grades.findIndex(g => pct >= g.min && pct <= g.max);
                if (idx >= 0) counts[idx]++;
            }

            if (!wrapper.querySelector('canvas')) {
                wrapper.innerHTML = '<canvas id="grade-distribution-canvas"></canvas>';
            }

            createBarChart('grade-distribution-canvas', grades.map(g => g.grade), [{
                label: 'Students',
                data: counts,
                backgroundColor: grades.map(g => g.bg || '#94a3b8')
            }]);
        }
        window.renderGradeDistributionPreview = renderGradeDistributionPreview;

        function addGradeLevel() {
            const grades = state.gradingScale || DEFAULT_GRADES;
            showModal(`<div class="modal-overlay"><div class="modal modal-sm"><div class="modal-header"><h3>➕ Add Grade Level</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-body"><div class="form-grid"><div class="form-group"><label>Grade</label><input id="new-grade-name" class="form-control" placeholder="e.g. A+"></div><div class="form-group"><label>Min %</label><input type="number" id="new-grade-min" class="form-control" placeholder="0" min="0" max="100"></div><div class="form-group"><label>Max %</label><input type="number" id="new-grade-max" class="form-control" placeholder="100" min="0" max="100"></div><div class="form-group"><label>Description</label><input id="new-grade-desc" class="form-control" placeholder="Optional"></div><div class="form-group"><label>Color</label><input type="color" id="new-grade-color" class="form-control" value="#10b981"></div></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="window._saveNewGrade()">Add</button></div></div></div>`);
            window._saveNewGrade = async () => {
                const name = document.getElementById('new-grade-name')?.value.trim();
                const min = parseInt(document.getElementById('new-grade-min')?.value);
                const max = parseInt(document.getElementById('new-grade-max')?.value);
                if (!name || isNaN(min) || isNaN(max)) { showToast('Grade name, min, and max are required', 'warning'); return; }
                if (min >= max) { showToast('Min must be less than max', 'warning'); return; }
                await insert('grading_scale', { grade: name, min_percentage: min, max_percentage: max, description: document.getElementById('new-grade-desc')?.value, color: document.getElementById('new-grade-color')?.value, sort_order: state.gradingScale.length + 1, created_at: new Date().toISOString() });
                await refreshTable('grading_scale');
                closeModal();
                showToast('✅ Grade level added', 'success');
                renderGradingScale(document.getElementById('dynamic-content'));
            };
        }
        window.addGradeLevel = addGradeLevel;

        function removeGradeLevel(idx) {
            showModal(`<div class="modal-overlay"><div class="modal modal-sm"><div class="modal-header"><h3>🗑️ Remove Grade Level</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-body"><p>Are you sure you want to remove "${state.gradingScale[idx]?.grade}"?</p></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-danger" onclick="window._confirmRemoveGrade(${idx})">Remove</button></div></div></div>`);
            window._confirmRemoveGrade = async (index) => {
                const grade = state.gradingScale[index];
                if (!grade) return;
                if (grade.id) await remove('grading_scale', grade.id);
                state.gradingScale = state.gradingScale.filter((_, i) => i !== index);
                closeModal();
                showToast('✅ Grade level removed', 'success');
                renderGradingScale(document.getElementById('dynamic-content'));
            };
        }
        window.removeGradeLevel = removeGradeLevel;

        async function resetGradingScale() {
            if (!await confirmDialog('Reset to default grading scale? This will overwrite your current scale.')) return;
            await removeWhere('grading_scale', 'id=gt.0');
            for (const g of DEFAULT_GRADES) {
                await insert('grading_scale', {
                    grade: g.grade,
                    min_percentage: g.min,
                    max_percentage: g.max,
                    description: g.desc,
                    color: g.color,
                    sort_order: g.sort_order,
                    created_at: new Date().toISOString()
                });
            }
            await refreshTable('grading_scale');
            showToast('✅ Grading scale reset to defaults', 'success');
            renderGradingScale(document.getElementById('dynamic-content'));
        }
        window.resetGradingScale = resetGradingScale;

        async function saveGradingScale() {
            const grades = state.gradingScale || DEFAULT_GRADES;
            let saved = 0;

            for (let i = 0; i < grades.length + 5; i++) {
                const gradeEl = document.getElementById(`grade-name-${i}`);
                if (!gradeEl) break;
                const grade = gradeEl.value?.trim();
                const minPct = parseInt(document.getElementById(`grade-min-${i}`)?.value);
                const maxPct = parseInt(document.getElementById(`grade-max-${i}`)?.value);
                const desc = document.getElementById(`grade-desc-${i}`)?.value?.trim() || '';
                const color = document.getElementById(`grade-color-${i}`)?.value || '#d1fae5';
                const order = parseInt(document.getElementById(`grade-order-${i}`)?.value) || i + 1;
                if (!grade || isNaN(minPct) || isNaN(maxPct)) continue;

                const existing = grades[i];
                if (existing?.id) {
                    await update('grading_scale', existing.id, {
                        grade, min_percentage: minPct, max_percentage: maxPct,
                        description: desc, color, sort_order: order
                    });
                } else {
                    await insert('grading_scale', {
                        grade, min_percentage: minPct, max_percentage: maxPct,
                        description: desc, color, sort_order: order,
                        created_at: new Date().toISOString()
                    });
                }
                saved++;
            }

            await refreshTable('grading_scale');
            showToast(`✅ Saved ${saved} grade levels`, 'success');
            renderGradingScale(document.getElementById('dynamic-content'));
        }
        window.saveGradingScale = saveGradingScale;

        // ================================================================
