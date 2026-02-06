// ================================================
// FILE: public/js/applicants.js
// ================================================
const API_BASE = '/api/applicants'; // <--- FIXED: Was likely just '/api' before
let currentPage = 1;
const limit = 10;

function getToken() { return localStorage.getItem('admin_token'); }

async function fetchApplicants() {
    const search = document.getElementById('search-input').value;
    const sort = document.getElementById('sort-select').value;

    try {
        const res = await fetch(`${API_BASE}?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const result = await res.json();

        if (result.success) {
            renderTable(result.data.applicants);
            updateKPIs(result.data.stats);
            updatePagination(result.data.pagination);
        }
    } catch (err) {
        console.error(err);
    }
}

function renderTable(data) {
    const tbody = document.getElementById('applicants-body');
    
    // Reset Multi-Delete UI on re-render
    const checkAll = document.getElementById('check-all');
    if(checkAll) checkAll.checked = false;
    const delBtn = document.getElementById('multi-delete-btn');
    if(delBtn) delBtn.style.display = 'none';

    tbody.innerHTML = data.map(app => {
        const date = new Date(app.created_at).toLocaleDateString();
        const badgeClass = `badge-${app.status.toLowerCase().replace(' ', '-')}`;
        return `
            <tr>
                <td><input type="checkbox" class="row-checkbox" value="${app.id}"></td>
                <td>#${String(app.id).padStart(4, '0')}</td>
                <td><strong>${app.first_name} ${app.last_name}</strong></td>
                <td>${app.email}</td>
                <td>${app.gender || '-'}</td>
                <td>${app.position_applied}</td>
                <td><span class="badge ${badgeClass}">${app.status}</span></td>
                <td>${date}</td>
                <td>
                    <a href="applicant-details.html?id=${app.id}" class="btn-action" style="color:#333;"><i class="bi bi-three-dots-vertical"></i></a>
                </td>
            </tr>
        `;
    }).join('');
}

function updateKPIs(stats) {
    // Only update if elements exist (in case KPIs are removed from UI later)
    if(document.getElementById('kpi-total')) document.getElementById('kpi-total').innerText = stats.total;
    if(document.getElementById('kpi-male')) document.getElementById('kpi-male').innerText = stats.male;
    if(document.getElementById('kpi-female')) document.getElementById('kpi-female').innerText = stats.female;
    if(document.getElementById('kpi-month')) document.getElementById('kpi-month').innerText = stats.this_month;
}

function updatePagination(pagination) {
    document.getElementById('page-info').innerText = `Page ${pagination.current_page} of ${pagination.total_pages} (${pagination.total_records} records)`;
    document.getElementById('prev-btn').disabled = pagination.current_page === 1;
    document.getElementById('next-btn').disabled = pagination.current_page >= pagination.total_pages;
}

document.addEventListener('DOMContentLoaded', () => {
    fetchApplicants();
    
    // Search & Sort Events
    document.getElementById('search-input').addEventListener('input', () => { currentPage = 1; fetchApplicants(); });
    document.getElementById('sort-select').addEventListener('change', fetchApplicants);
    
    // Pagination Events
    document.getElementById('prev-btn').addEventListener('click', () => { if(currentPage > 1) { currentPage--; fetchApplicants(); } });
    document.getElementById('next-btn').addEventListener('click', () => { currentPage++; fetchApplicants(); });

    // INITIALIZE MULTI DELETE
    // The function 'setupMultiDelete' comes from admin.js
    setupMultiDelete({
        tableBodyId: 'applicants-body',
        checkAllId: 'check-all',
        deleteBtnId: 'multi-delete-btn',
        apiBaseUrl: API_BASE, // Loop will append ID
        onSuccess: fetchApplicants
    });
});