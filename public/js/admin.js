// ================================================
// FILE: public/js/admin.js (CLEANED & FIXED)
// ================================================
const API_URL = '/api';

// --- 1. SHARED UTILITIES (Auth & Helpers) ---

function getToken() {
    return localStorage.getItem('admin_token');
}

function checkAuth() {
    const path = window.location.pathname;
    // Don't check auth on login page
    if (!getToken() && !path.includes('login.html')) {
        window.location.href = 'login.html';
    }
    // If we have a token and are ON login page, go to dashboard
    if (getToken() && path.includes('login.html')) {
        window.location.href = 'admin-dashboard.html';
    }
}

function logout() {
    localStorage.removeItem('admin_token');
    window.location.href = 'login.html';
}

// --- 2. UNIVERSAL MULTI-DELETE FUNCTION ---
// This is now available to any page that includes admin.js
function setupMultiDelete({ 
    tableBodyId, checkAllId, deleteBtnId, containerId, 
    apiBaseUrl, urlSuffix = '', onSuccess, 
    entityName = 'items' // <--- 1. ADD THIS DEFAULT PARAMETER
}) {
    const tbody = document.getElementById(tableBodyId);
    const checkAll = document.getElementById(checkAllId);
    const deleteBtn = document.getElementById(deleteBtnId);
    
    // If we passed a containerId (the div holding both buttons), use that for visibility
    // Otherwise fall back to just the button itself
    const container = containerId ? document.getElementById(containerId) : deleteBtn;

    if (!tbody || !deleteBtn) return;

    const getSelectedIds = () => Array.from(tbody.querySelectorAll('.row-checkbox:checked')).map(cb => cb.value);

    const updateVisibility = () => {
        const count = getSelectedIds().length;
        if (count > 0) {
            container.style.display = 'inline-flex'; // Show the container/button
            // Update button text if it's the standard one
            if(!urlSuffix) deleteBtn.innerHTML = `<i class="bi bi-trash-fill"></i> Delete Selected (${count})`;
            else deleteBtn.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> Force Delete (${count})`;
        } else {
            container.style.display = 'none';
        }
    };

    // Attach Checkbox Listeners (Only once if shared, but safe to re-attach loosely)
    // To prevent double-binding logic on the 'Select All', strictly bind listeners only if not already bound? 
    // Easier way: existing logic is fine, it just runs updateVisibility twice which is harmless.
    
    if (checkAll) {
        checkAll.addEventListener('change', (e) => {
            tbody.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = e.target.checked);
            updateVisibility();
        });
    }

    tbody.addEventListener('change', (e) => {
        if (e.target.classList.contains('row-checkbox')) {
            if (checkAll) {
                const all = tbody.querySelectorAll('.row-checkbox');
                checkAll.checked = Array.from(all).every(cb => cb.checked);
            }
            updateVisibility();
        }
    });

    deleteBtn.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if (ids.length === 0) return;
        
        // 2. UPDATE THE WARNING TEXT LOGIC HERE:
        const warning = urlSuffix 
            ? `WARNING: This will delete ${ids.length} ${entityName} AND their history. This cannot be undone.`
            : `Are you sure you want to delete ${ids.length} ${entityName}?`;

        if (!confirm(warning)) return;

        deleteBtn.disabled = true;
        deleteBtn.innerText = "...";
        const token = getToken();

        const deletePromises = ids.map(id => 
            fetch(`${apiBaseUrl}/${id}${urlSuffix}`, { // Use Suffix here
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => res.json())
        );

        const results = await Promise.all(deletePromises);
        
        // Simple reporting for now to save space
        const success = results.filter(r => r.success).length;
        const failed = results.length - success;
        
        let msg = `Deleted: ${success}`;
        if(failed > 0) msg += `\nFailed: ${failed} (Likely deployed. Use Force Delete)`;
        alert(msg);

        if(checkAll) checkAll.checked = false;
        container.style.display = 'none';
        deleteBtn.disabled = false;
        if (onSuccess) onSuccess();
    });
}


// --- 3. DASHBOARD SPECIFIC LOGIC ---
// Only runs if we find dashboard-specific elements
async function initDashboard() {
    // Check if we are actually on the dashboard
    if (!document.getElementById('dash-total')) return; 

    try {
        const token = getToken();
        // Use the dashboard-stats endpoint we created earlier
        const res = await fetch(`${API_URL}/dashboard-stats`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        const json = await res.json();

        if (json.success) {
            const data = json.data;
            document.getElementById('dash-total').innerText = data.counts.total;
            document.getElementById('dash-pending').innerText = data.counts.pending;
            document.getElementById('dash-deployed').innerText = data.counts.active_deployments;
            
            // Render Chart
            renderChart(data.chart);

            // Render Recent Table
            const tbody = document.getElementById('recent-body');
            if(tbody) {
                tbody.innerHTML = data.recent.map(a => `
                    <tr>
                        <td>#${String(a.id).padStart(4, '0')}</td>
                        <td><strong>${a.first_name} ${a.last_name}</strong></td>
                        <td>${a.position_applied}</td>
                        <td>${new Date(a.created_at).toLocaleDateString()}</td>
                        <td><span class="badge badge-${a.status.toLowerCase().replace(' ', '-')}">${a.status}</span></td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error("Dashboard Load Error:", err);
    }
}

// Chart Renderer (Helper for Dashboard)
function renderChart(chartData) {
    const container = document.getElementById('chart-bars');
    if (!container) return;
    
    if (!chartData || chartData.length === 0) {
        container.innerHTML = '<p style="text-align:center; width:100%; color:#999;">No data</p>';
        return;
    }
    
    const maxVal = Math.max(...chartData.map(d => d.count)) || 1;

    container.innerHTML = chartData.map(d => {
        const date = new Date(d.month + '-01'); 
        const label = date.toLocaleString('default', { month: 'short' });
        const height = (d.count / maxVal) * 80;
        return `
            <div class="bar-group">
                <div class="bar-bg">
                    <div class="bar" style="height: ${height}%;" title="${d.count} Applicants"></div>
                </div>
                <span class="bar-label">${label}</span>
            </div>`;
    }).join('');
}

// --- 4. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Run Auth Check everywhere (except login)
    checkAuth();
    
    // Logout Handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // --- [NEW] LOGIN FORM HANDLER ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                const res = await fetch('/api/auth/login', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const json = await res.json();

                if (json.success) {
                    localStorage.setItem('admin_token', json.data.token);
                    window.location.href = 'admin-dashboard.html';
                } else {
                    alert('Login failed');
                }
            } catch (err) {
                console.error(err);
            }
        });
    }
    
    // Try to run dashboard logic (will exit safely if not on dashboard)
    initDashboard();
});