const API_BASE = '/api/branches';
let currentPage = 1;
const limit = 10;

function getToken() {
    return localStorage.getItem('admin_token');
}

async function fetchBranches() {
    const search = document.getElementById('search-input').value;
    const sort = document.getElementById('sort-select').value;
    
    try {
        const res = await fetch(`${API_BASE}?page=${currentPage}&limit=${limit}&search=${search}&sort=${sort}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const result = await res.json();
        
        if (result.success) {
            renderTable(result.data.branches);
            updateStats(result.data.stats);
            updatePagination(result.data.pagination);
        }
    } catch (err) {
        console.error(err);
    }
}

function renderTable(branches) {
    const tbody = document.getElementById('branches-body');
    
    // Reset UI
    const checkAll = document.getElementById('check-all');
    if(checkAll) checkAll.checked = false;
    const delBtn = document.getElementById('multi-delete-btn');
    if(delBtn) delBtn.style.display = 'none';

    tbody.innerHTML = branches.map(b => `
        <tr>
            <td><input type="checkbox" class="row-checkbox" value="${b.id}"></td>
            <td>#${b.id}</td>
            <td><strong>${b.name}</strong></td>
            <td>${b.location}</td>
            <td>${b.required_guards}</td>
            <td>
                <button onclick="editBranch(${b.id}, '${b.name}', '${b.location}', ${b.required_guards})" class="btn-action" style="color:#2b6cb0;"><i class="bi bi-pencil-square"></i></button>
            </td>
        </tr>
    `).join('');
}

function updateStats(stats) {
    document.getElementById('total-branches').innerText = stats.total_branches;
    document.getElementById('total-locations').innerText = stats.total_locations;
}

function updatePagination(pagination) {
    document.getElementById('page-info').innerText = `Page ${pagination.current_page} of ${pagination.total_pages} (${pagination.total_records} records)`;
    document.getElementById('prev-btn').disabled = pagination.current_page === 1;
    document.getElementById('next-btn').disabled = pagination.current_page === pagination.total_pages || pagination.total_pages === 0;
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('branch-id').value;
    const name = document.getElementById('branch-name').value;
    const location = document.getElementById('branch-location').value;
    const guards = document.getElementById('branch-guards').value;

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/${id}` : API_BASE;

    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ name, location, required_guards: guards })
        });
        
        if (res.ok) {
            closeModal();
            fetchBranches();
        } else {
            alert('Operation failed');
        }
    } catch (err) {
        console.error(err);
    }
}

async function deleteBranch(id) {
    if (!confirm('Are you sure you want to delete this branch?')) return;
    
    await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    fetchBranches();
}

function openModal() {
    document.getElementById('branch-modal').style.display = 'flex';
    document.getElementById('branch-form').reset();
    document.getElementById('branch-id').value = '';
    document.getElementById('modal-title').innerText = 'Add Branch';
}

function editBranch(id, name, location, guards) {
    openModal();
    document.getElementById('branch-id').value = id;
    document.getElementById('branch-name').value = name;
    document.getElementById('branch-location').value = location;
    document.getElementById('branch-guards').value = guards;
    document.getElementById('modal-title').innerText = 'Edit Branch';
}

function closeModal() {
    document.getElementById('branch-modal').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    fetchBranches();
    
    document.getElementById('search-input').addEventListener('input', () => { currentPage = 1; fetchBranches(); });
    document.getElementById('sort-select').addEventListener('change', fetchBranches);
    document.getElementById('prev-btn').addEventListener('click', () => { if(currentPage > 1) { currentPage--; fetchBranches(); } });
    document.getElementById('next-btn').addEventListener('click', () => { currentPage++; fetchBranches(); });
    document.getElementById('branch-form').addEventListener('submit', handleFormSubmit);

    // Initialize Multi Delete
    setupMultiDelete({
        tableBodyId: 'branches-body',
        checkAllId: 'check-all',
        deleteBtnId: 'multi-delete-btn',
        apiBaseUrl: '/api/branches',
        entityName: 'branches', // <--- ADD THIS LINE
        onSuccess: fetchBranches
    });
});