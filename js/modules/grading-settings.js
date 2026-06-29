// js/modules/grading-settings.js
// Grading Settings Module - Configure grading scale and grade boundaries


async function renderGradingSettings(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    const grades = state.gradingScale || [];

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Grading Scale Settings</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-success" onclick="window.saveGradingScale()">💾 Save All</button>
                    <button class="btn btn-sm btn-outline" onclick="window.exportGradingScale()">📥 Export</button>
                    <button class="btn btn-sm btn-outline" onclick="window.resetToDefaultScale()">🔄 Reset to Default</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="alert alert-info" style="margin-bottom:16px">
                    <strong>📐 Grading Scale Rules:</strong> Grades are calculated based on percentage scores. 
                    Students receive the grade corresponding to the percentage range.
                </div>
                
                <div class="table-wrapper">
                    <table class="data-table" id="grading-scale-table">
                        <thead>
                            <tr>
                                <th>Grade</th>
                                <th>Min %</th>
                                <th>Max %</th>
                                <th>Description</th>
                                <th>Color</th>
                                <th>Order</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="grading-scale-tbody">
                            ${grades.map((g, i) => `
                                <tr>
                                    <td><input type="text" id="grade-name-${i}" value="${esc(g.grade)}" class="form-control" style="width:80px"></span>
                                    <td><input type="number" id="grade-min-${i}" value="${g.min_percentage !== undefined ? g.min_percentage : g.min}" class="form-control" style="width:80px" min="0" max="100"></span>
                                    <td><input type="number" id="grade-max-${i}" value="${g.max_percentage !== undefined ? g.max_percentage : g.max}" class="form-control" style="width:80px" min="0" max="100"></span>
                                    <td><input type="text" id="grade-desc-${i}" value="${esc(g.description || g.desc || '')}" class="form-control" style="width:150px"></span>
                                    <td><input type="color" id="grade-color-${i}" value="${g.color || g.bg || '#d1fae5'}" style="width:50px; height:34px"></span>
                                    <td><input type="number" id="grade-order-${i}" value="${g.sort_order || i + 1}" class="form-control" style="width:60px" min="1"></span>
                                    <td>
                                        <button class="btn btn-sm btn-outline" onclick="window.moveGradeUp(${i})" title="Move Up">▲</button>
                                        <button class="btn btn-sm btn-outline" onclick="window.moveGradeDown(${i})" title="Move Down">▼</button>
                                        <button class="btn btn-sm btn-danger" onclick="window.removeGradeLevel(${i})" title="Remove">🗑️</button>
                                     </span>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="btn-group" style="margin-top:16px">
                    <button class="btn btn-sm btn-outline" onclick="window.addGradeLevel()">➕ Add Grade Level</button>
                    <button class="btn btn-sm btn-outline" onclick="window.previewGradeDistribution()">📊 Preview Distribution</button>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📈 Grade Distribution Preview</span>
            </div>
            <div class="dash-card-body">
                <div id="grade-distribution-preview" class="table-wrapper">
                    <div class="loading-container"><div class="spinner"></div><p>Select preview to see distribution</p></div>
                </div>
            </div>
        </div>
    `;

    window.saveGradingScale = saveGradingScale;
    window.exportGradingScale = exportGradingScale;
    window.resetToDefaultScale = resetToDefaultScale;
    window.addGradeLevel = addGradeLevel;
    window.removeGradeLevel = removeGradeLevel;
    window.moveGradeUp = moveGradeUp;
    window.moveGradeDown = moveGradeDown;
    window.previewGradeDistribution = previewGradeDistribution;
}

async function saveGradingScale() {
    const grades = [];
    const rowCount = document.querySelectorAll('#grading-scale-tbody tr').length;

    for (let i = 0; i < rowCount; i++) {
        const grade = document.getElementById(`grade-name-${i}`)?.value.trim();
        const min = parseInt(document.getElementById(`grade-min-${i}`)?.value);
        const max = parseInt(document.getElementById(`grade-max-${i}`)?.value);
        const description = document.getElementById(`grade-desc-${i}`)?.value;
        const color = document.getElementById(`grade-color-${i}`)?.value;
        const sortOrder = parseInt(document.getElementById(`grade-order-${i}`)?.value) || i + 1;

        if (grade && !isNaN(min) && !isNaN(max)) {
            grades.push({
                grade: grade,
                min_percentage: min,
                max_percentage: max,
                description: description,
                color: color,
                sort_order: sortOrder
            });
        }
    }

    // Validate grade ranges don't overlap
    const sorted = [...grades].sort((a, b) => a.min_percentage - b.min_percentage);
    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].max_percentage >= sorted[i + 1].min_percentage) {
            showToast(`❌ Grade ranges overlap: ${sorted[i].grade} (${sorted[i].max_percentage}%) overlaps with ${sorted[i + 1].grade} (${sorted[i + 1].min_percentage}%)`, 'error');
            return;
        }
    }

    // Clear existing and insert new
    await removeWhere('grading_scale', 'id IS NOT NULL');
    for (const g of grades) {
        await insert('grading_scale', g);
    }

    await refreshTable('grading_scale');
    showToast('✅ Grading scale saved', 'success');
    renderGradingSettings(document.getElementById('dynamic-content'));
}

function exportGradingScale() {
    const grades = state.gradingScale || [];
    const data = grades.map(g => ({
        'Grade': g.grade,
        'Minimum %': g.min_percentage !== undefined ? g.min_percentage : g.min,
        'Maximum %': g.max_percentage !== undefined ? g.max_percentage : g.max,
        'Description': g.description || g.desc || '',
        'Color': g.color || g.bg || '#d1fae5',
        'Sort Order': g.sort_order || 0
    }));

    exportToExcel(data, `Grading_Scale_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Grading scale exported', 'success');
}

async function resetToDefaultScale() {
    if (!await confirmDialog('Reset grading scale to default (A+, A, B, C, D, F)?')) return;

    const defaultGrades = [
        { grade: 'A+', min_percentage: 90, max_percentage: 100, description: 'Excellent', color: '#d1fae5', sort_order: 1 },
        { grade: 'A', min_percentage: 80, max_percentage: 89, description: 'Very Good', color: '#d1fae5', sort_order: 2 },
        { grade: 'B', min_percentage: 70, max_percentage: 79, description: 'Good', color: '#fef3c7', sort_order: 3 },
        { grade: 'C', min_percentage: 60, max_percentage: 69, description: 'Average', color: '#ffedd5', sort_order: 4 },
        { grade: 'D', min_percentage: 50, max_percentage: 59, description: 'Below Average', color: '#fee2e2', sort_order: 5 },
        { grade: 'F', min_percentage: 0, max_percentage: 49, description: 'Fail', color: '#fce7f3', sort_order: 6 }
    ];

    await removeWhere('grading_scale', 'id IS NOT NULL');
    for (const g of defaultGrades) {
        await insert('grading_scale', g);
    }

    await refreshTable('grading_scale');
    showToast('✅ Grading scale reset to default', 'success');
    renderGradingSettings(document.getElementById('dynamic-content'));
}

function addGradeLevel() {
    const grades = [...(state.gradingScale || [])];
    const newGrade = {
        grade: 'X',
        min_percentage: 0,
        max_percentage: 0,
        description: 'New Grade',
        color: '#e2e8f0',
        sort_order: grades.length + 1
    };
    grades.push(newGrade);
    state.gradingScale = grades;
    renderGradingSettings(document.getElementById('dynamic-content'));
    showToast('New grade level added. Set values and save.', 'info');
}

function removeGradeLevel(index) {
    const grades = [...(state.gradingScale || [])];
    if (grades.length <= 2) {
        showToast('Cannot remove: Minimum 2 grade levels required', 'warning');
        return;
    }
    grades.splice(index, 1);
    state.gradingScale = grades;
    renderGradingSettings(document.getElementById('dynamic-content'));
    showToast('Grade level removed. Save to confirm changes.', 'info');
}

function moveGradeUp(index) {
    if (index === 0) return;
    const grades = [...(state.gradingScale || [])];
    [grades[index - 1], grades[index]] = [grades[index], grades[index - 1]];
    state.gradingScale = grades;
    renderGradingSettings(document.getElementById('dynamic-content'));
}

function moveGradeDown(index) {
    const grades = [...(state.gradingScale || [])];
    if (index >= grades.length - 1) return;
    [grades[index], grades[index + 1]] = [grades[index + 1], grades[index]];
    state.gradingScale = grades;
    renderGradingSettings(document.getElementById('dynamic-content'));
}

function previewGradeDistribution() {
    const grades = state.gradingScale || [];
    const container = document.getElementById('grade-distribution-preview');

    if (grades.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No grading scale configured</div>';
        return;
    }

    // Calculate distribution based on sample data or actual marks
    const marks = state.marks || [];
    const gradeCounts = {};
    grades.forEach(g => gradeCounts[g.grade] = 0);

    for (const mark of marks) {
        const assessment = state.assessments.find(a => a.id === mark.assessment_id);
        if (assessment && assessment.max_marks > 0) {
            const percentage = (mark.score / assessment.max_marks) * 100;
            const grade = getGradeFromScale(percentage, grades);
            if (gradeCounts[grade] !== undefined) gradeCounts[grade]++;
        }
    }

    const totalMarks = marks.length || 1;

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr><th>Grade</th><th>Range</th><th>Students (Sample)</th><th>Distribution</th></tr>
            </thead>
            <tbody>
                ${grades.map(g => {
        const count = gradeCounts[g.grade] || 0;
        const percentage = totalMarks > 0 ? (count / totalMarks) * 100 : 0;
        return `
                        <tr>
                            <td><span class="badge" style="background:${g.color || '#e2e8f0'}; color:#1a3a5c">${esc(g.grade)}</span></span>
                            <td>${g.min_percentage}% - ${g.max_percentage}%</span>
                            <td>${count}</span>
                            <td>
                                <div style="background:var(--border-light); border-radius:99px; height:8px; overflow:hidden; width:100px">
                                    <div style="width:${percentage}%; height:100%; background:${g.color || '#0d9488'}; border-radius:99px;"></div>
                                </div>
                                <span style="margin-left:8px">${percentage.toFixed(1)}%</span>
                             </span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
            <tfoot>
                <tr><td colspan="4" class="alert alert-info">Based on ${totalMarks} marks entered in the system</td></tr>
            </tfoot>
        </table>
    `;
}

function getGradeFromScale(percentage, grades) {
    const sorted = [...grades].sort((a, b) => b.min_percentage - a.min_percentage);
    for (const grade of sorted) {
        if (percentage >= grade.min_percentage && percentage <= grade.max_percentage) {
            return grade.grade;
        }
    }
    return 'F';
}