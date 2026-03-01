const API_BASE = '/api/deployments';
let currentPage = 1;
const limit = 10;
let currentFilter = 'all'; 
let allBranchesMap = {}; 

function getToken() {
    return localStorage.getItem('admin_token');
}

async function fetchDeployments() {
    const search = document.getElementById('search-input').value;
    const sort = document.getElementById('sort-select').value;
    
    try {
        const branchRes = await fetchData('/api/branches?limit=1000', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (branchRes.success && branchRes.data.branches) {
            allBranchesMap = branchRes.data.branches.reduce((acc, b) => {
                acc[b.id] = { ...b, active_count: 0 };
                return acc;
            }, {});
        }
    } catch (bErr) { console.warn("Could not load branches for map"); }

    try {
        // FIX: Pass the 'status' (currentFilter) to the backend API!
        const url = `${API_BASE}?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}&status=${currentFilter}`;
        
        const result = await fetchData(url, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        
        if (result.success) {
            const deps = result.data.deployments || [];
            
            // Recalculate branch mapping logic
            Object.values(allBranchesMap).forEach(b => b.active_count = 0);
            deps.forEach(d => {
                if (d.status === 'Active') {
                    const branch = Object.values(allBranchesMap).find(b => b.name === d.branch_name);
                    if (branch) branch.active_count++;
                }
            });

            // NO MORE applyFilters(). Just render directly from backend!
            renderTable(deps);
            updateStats(result.data.stats);
            updatePagination(result.data.pagination);
        }
    } catch (err) {
        console.error(err);
    }
}

// Update filter chip click listener to trigger fetch
document.getElementById('filter-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    
    currentFilter = chip.getAttribute('data-filter');
    currentPage = 1;
    fetchDeployments(); // Ask backend for the filtered list
});

function renderTable(data) {
    const tbody = document.getElementById('deploy-body');
    tbody.innerHTML = data.map(d => {
        const dateStr = new Date(d.date_deployed).toLocaleDateString();
        const badgeClass = d.status === 'Active' ? 'badge-hired' : 'badge-rejected';
        
        return `
        <tr>
            <td>#${d.id}</td>
            <td><strong>${d.first_name} ${d.last_name}</strong></td>
            <td>${d.branch_name}</td>
            <td>${dateStr}</td>
            <td><span class="badge ${badgeClass}">${d.status}</span></td>
            <td>
                ${d.status === 'Active' 
                    ? `<button onclick="endDeployment(${d.id})" class="btn-outline-custom" style="color:#c53030; border-color:#c53030; font-size:0.75rem;">End Duty</button>` 
                    : '<span class="text-muted">-</span>'}
            </td>
        </tr>
    `}).join('');
}

function updateStats(stats) {
    document.getElementById('stat-total').innerText = stats.total_deployments;
    document.getElementById('stat-active').innerText = stats.total_active;
    document.getElementById('stat-month').innerText = stats.this_month;
}

function updatePagination(pagination) {
    document.getElementById('page-info').innerText = `Page ${pagination.current_page} of ${pagination.total_pages}`;
    document.getElementById('prev-btn').disabled = pagination.current_page === 1;
    document.getElementById('next-btn').disabled = pagination.current_page >= pagination.total_pages;
}

async function endDeployment(id) {
    if(!confirm("Are you sure you want to end this guard's deployment?")) return;

    try {
        await fetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}` 
            },
            body: JSON.stringify({ status: 'Ended' })
        });
        fetchDeployments();
    } catch(err) {
        console.error(err);
    }
}

let searchTimeout;

document.addEventListener('DOMContentLoaded', () => {
    fetchDeployments();
    
    // 1. Debounced Search Input
    document.getElementById('search-input').addEventListener('input', (e) => { 
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentPage = 1; 
            fetchDeployments(); 
        }, 300); // Waits 300ms after you stop typing before fetching
    });

    // 2. Sort Select
    document.getElementById('sort-select').addEventListener('change', () => {
        currentPage = 1;
        fetchDeployments();
    });

    // 3. Pagination
    document.getElementById('prev-btn').addEventListener('click', (e) => { 
        e.stopImmediatePropagation();
        if(currentPage > 1) { currentPage--; fetchDeployments(); } 
    });
    
    document.getElementById('next-btn').addEventListener('click', (e) => { 
        e.stopImmediatePropagation();
        currentPage++; fetchDeployments(); 
    });
});