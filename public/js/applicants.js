// ================================================
// FILE: public/js/applicants.js
// ================================================
const API_BASE = '/api/applicants';
let currentPage = 1;
const limit = 12; // Increased limit because cards look better with more items
let currentFilter = ''; // Empty means 'All'

function getToken() { return localStorage.getItem('admin_token'); }

async function fetchApplicants() {
    const search = document.getElementById('search-input').value;
    const sort = document.getElementById('sort-select').value;

    let url = `${API_BASE}?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}`;
    if (currentFilter) url += `&status=${currentFilter}`;

    try {
        // USE THE NEW HELPER
        const result = await fetchData(url, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (result.success) {
            renderCards(result.data.applicants);
            updateKPIs(result.data.stats);
            updatePagination(result.data.pagination);
        }
    } catch (err) {
        console.error(err);
        document.getElementById('applicants-grid').innerHTML = 
            '<div class="text-center p-5 text-muted"><i class="bi bi-wifi-off"></i> Offline mode: No cached data found.</div>';
    }
}

function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

function renderCards(data) {
    const grid = document.getElementById('applicants-grid');
    const hiddenTbody = document.getElementById('applicants-body');
    const searchField = document.getElementById('search-input');
    const searchQuery = searchField ? searchField.value : '';
    
    // Reset Select All
    const checkAll = document.getElementById('check-all');
    if(checkAll) checkAll.checked = false;
    
    // Reset Delete Actions Visibility
    const actionDiv = document.getElementById('delete-actions');
    if(actionDiv) actionDiv.style.display = 'none';

    if (data.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; padding: 40px; text-align: center; color: #64748b; background: white; border-radius: 16px; border: 1px dashed #cbd5e1;">
                <i class="bi bi-inbox" style="font-size: 2rem; display: block; margin-bottom: 12px;"></i>
                No applicants found.
            </div>`;
        hiddenTbody.innerHTML = '';
        return;
    }

    // 1. Render the visual cards
    grid.innerHTML = data.map(app => {
        const date = new Date(app.created_at).toLocaleDateString();
        
        // Determine badge styling based on status
        let badgeClass = 'warning';
        let badgeIcon = 'bi-hourglass-split';
        if(app.status === 'Hired') { badgeClass = 'secured'; badgeIcon = 'bi-check-circle-fill'; }
        if(app.status === 'Rejected') { badgeClass = 'critical'; badgeIcon = 'bi-x-circle-fill'; }
        if(app.status === 'For Interview') { badgeClass = 'secured'; badgeIcon = 'bi-calendar-event'; } // Blue-ish ideally, but secured is fine

        return `
            <div class="facility-card" data-id="${app.id}" onclick="toggleCardSelection(this, event)">
                <div class="selection-overlay">
                    <input type="checkbox" class="card-checkbox" value="${app.id}" onclick="event.stopPropagation()">
                    <i class="bi bi-check-circle-fill"></i>
                </div>
                
                <div class="tag-container">
                    <div class="card-tag ${badgeClass}">
                        <i class="bi ${badgeIcon}"></i> ${app.status}
                    </div>
                </div>

                <div class="guard-profile" style="margin-top: 10px;">
                    <div class="guard-avatar-placeholder">
                        <i class="bi bi-person-bounding-box"></i>
                    </div>
                    <div class="guard-info">
                        <h3 style="font-size: 1.1rem; margin-bottom: 4px;">${highlightText(app.first_name + ' ' + app.last_name, searchQuery)}</h3>
                        <p style="color: #10b981; font-weight: 700; margin: 0;"><i class="bi bi-briefcase"></i> ${app.position_applied}</p>
                    </div>
                </div>

                <div class="capacity-info" style="margin-top: 10px;">
                    <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.8rem; color: #475569;">
                        <div><i class="bi bi-envelope"></i> ${highlightText(app.email, searchQuery)}</div>
                        <div><i class="bi bi-telephone"></i> ${app.contact_num}</div>
                        <div><i class="bi bi-calendar3"></i> Applied: ${date}</div>
                    </div>
                </div>

                <div class="facility-actions">
                    <a href="applicant-details.html?id=${app.id}" class="btn-card-edit" onclick="event.stopPropagation()">
                        View Full Details <i class="bi bi-arrow-right"></i>
                    </a>
                </div>
            </div>
        `;
    }).join('');

    // 2. Render hidden table rows so multi-delete works automatically
    hiddenTbody.innerHTML = data.map(app => `
        <tr><td><input type="checkbox" class="row-checkbox" value="${app.id}"></td></tr>
    `).join('');
}

// Card Selection Logic
function toggleCardSelection(card, event) {
    if (event.target.closest('a') || event.target.closest('button')) return;
    
    const checkbox = card.querySelector('.card-checkbox');
    checkbox.checked = !checkbox.checked;
    card.classList.toggle('is-selected', checkbox.checked);

    // Sync with hidden table
    const hiddenCheckbox = document.querySelector(`#applicants-body input[value="${checkbox.value}"]`);
    if (hiddenCheckbox) {
        hiddenCheckbox.checked = checkbox.checked;
        hiddenCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

// Handle "Select All" click
document.addEventListener('DOMContentLoaded', () => {
    const checkAll = document.getElementById('check-all');
    if (checkAll) {
        checkAll.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            // Visually select cards
            document.querySelectorAll('.facility-card').forEach(card => {
                card.querySelector('.card-checkbox').checked = isChecked;
                card.classList.toggle('is-selected', isChecked);
            });
            // Multi-delete logic is handled by hidden table syncing in setupMultiDelete
        });
    }

    // Filter Chips Events
    document.getElementById('filter-chips').addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;

        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.getAttribute('data-filter');
        currentPage = 1;
        fetchApplicants();
    });
});

function updateKPIs(stats) {
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
    
    document.getElementById('search-input').addEventListener('input', () => { currentPage = 1; fetchApplicants(); });
    document.getElementById('sort-select').addEventListener('change', fetchApplicants);
    
    document.getElementById('prev-btn').addEventListener('click', () => { if(currentPage > 1) { currentPage--; fetchApplicants(); } });
    document.getElementById('next-btn').addEventListener('click', () => { currentPage++; fetchApplicants(); });

    // MULTI DELETE
    setupMultiDelete({
        tableBodyId: 'applicants-body',
        checkAllId: 'check-all',
        deleteBtnId: 'btn-delete-standard',
        containerId: 'delete-actions',
        apiBaseUrl: '/api/applicants',
        entityName: 'applicants',
        onSuccess: fetchApplicants
    });

    setupMultiDelete({
        tableBodyId: 'applicants-body',
        checkAllId: 'check-all',
        deleteBtnId: 'btn-delete-force',
        containerId: 'delete-actions',
        apiBaseUrl: '/api/applicants',
        urlSuffix: '?force=true',
        entityName: 'applicants',
        onSuccess: fetchApplicants
    });
});