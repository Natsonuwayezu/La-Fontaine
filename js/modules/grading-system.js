// ============================================================
// GRADING SYSTEM MODULE - Configure grade boundaries
// ============================================================


// Render Grading Scale page
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

// Add new grade level
window.addGradeLevel = function () {
    const tbody = document.getElementById('grading-scale-tbody');
    const currentCount = tbody.children.length;
    const newIndex = currentCount;

    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td><input type="text" id="grade-name-${newIndex}" value="X" style="width:70px"></td>
        <td><input type="number" id="grade-min-${newIndex}" value="0" style="width:70px"></td>
        <td><input type="number" id="grade-max-${newIndex}" value="0" style="width:70px"></td>
        <td><input type="text" id="grade-desc-${newIndex}" value="New Level" style="width:120px"></td>
        <td><input type="color" id="grade-color-${newIndex}" value="#d1fae5" style="width:50px"></td>
        <td><button class="btn btn-sm btn-danger" onclick="removeGradeLevel(${newIndex})">🗑️</button></td>
    `;
    tbody.appendChild(newRow);
    showToast('Grade level added — set values and save', 'info');
};

// Remove grade level
window.removeGradeLevel = function (index) {
    const row = document.getElementById('grading-scale-tbody')?.children[index];
    if (row) row.remove();
    showToast('Grade level removed — save to confirm', 'info');
};

// Save grading scale
window.saveGradingScale = async function () {
    const tbody = document.getElementById('grading-scale-tbody');
    const rows = tbody.children;
    const newScale = [];

    for (let i = 0; i < rows.length; i++) {
        const grade = document.getElementById(`grade-name-${i}`)?.value;
        const min = parseInt(document.getElementById(`grade-min-${i}`)?.value);
        const max = parseInt(document.getElementById(`grade-max-${i}`)?.value);
        const desc = document.getElementById(`grade-desc-${i}`)?.value;
        const color = document.getElementById(`grade-color-${i}`)?.value;

        if (grade && !isNaN(min) && !isNaN(max)) {
            newScale.push({ grade, min_percentage: min, max_percentage: max, description: desc, color });
        }
    }

    // Sort by min percentage
    newScale.sort((a, b) => a.min_percentage - b.min_percentage);

    // Clear existing and insert new
    await removeWhere('grading_scale', 'id IS NOT NULL');
    for (const g of newScale) {
        await insert('grading_scale', g);
    }

    await refreshTable('grading_scale');
    showToast('✅ Grading scale saved', 'success');
    renderGradingScale(document.getElementById('dynamic-content'));
};

// Reset to default grading scale
window.resetGradingScale = async function () {
    if (!await confirmDialog('Reset to default grading scale (A+=90, A=80, B=70, C=60, D=50, F=0)?')) return;

    await removeWhere('grading_scale', 'id IS NOT NULL');
    for (const g of DEFAULT_GRADES) {
        await insert('grading_scale', {
            grade: g.grade,
            min_percentage: g.min,
            max_percentage: g.max,
            description: g.desc,
            color: '#d1fae5'
        });
    }

    await refreshTable('grading_scale');
    showToast('✅ Grading scale reset to default', 'success');
    renderGradingScale(document.getElementById('dynamic-content'));
};

// Render grade distribution preview
async function renderGradeDistributionPreview() {
    const students = state.students || [];
    const assessments = state.assessments || [];
    const marks = state.marks || [];

    const gradeCount = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };

    for (const student of students) {
        let totalScore = 0, totalMax = 0;
        const studentAssessments = assessments.filter(a => a.class_id === student.class_id);

        for (const assessment of studentAssessments) {
            const mark = marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
            if (mark) {
                totalScore += mark.score;
                totalMax += assessment.max_marks;
            }
        }

        const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
        const grade = getGrade(percentage);
        if (gradeCount.hasOwnProperty(grade)) gradeCount[grade]++;
    }

    const total = students.length || 1;
    const container = document.getElementById('grade-distribution-chart');
    if (!container) return;

    container.innerHTML = `
        <div style="margin-top:12px">
            ${Object.entries(gradeCount).map(([grade, count]) => {
        const pct = (count / total) * 100;
        return `
                    <div style="margin-bottom:8px">
                        <div style="display:flex;justify-content:space-between;margin-bottom:2px">
                            <span><strong>${grade}</strong></span>
                            <span>${count} students (${pct.toFixed(1)}%)</span>
                        </div>
                        <div style="background:var(--border-light);border-radius:99px;height:8px;overflow:hidden">
                            <div style="width:${pct}%;height:100%;background:${getGradeColor(grade)};border-radius:99px;"></div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function getGradeColor(grade) {
    const colors = {
        'A+': '#10b981', 'A': '#34d399', 'B': '#60a5fa',
        'C': '#fbbf24', 'D': '#f97316', 'F': '#ef4444'
    };
    return colors[grade] || '#e2e8f0';
}

function getGrade(percentage) {
    const scale = state.gradingScale || DEFAULT_GRADES;
    for (const g of scale) {
        if (percentage >= g.min && percentage <= g.max) return g.grade;
    }
    return 'F';
}

async function ensureStateLoaded() {
    if (!state.gradingScale.length) await refreshTable('grading_scale');
}