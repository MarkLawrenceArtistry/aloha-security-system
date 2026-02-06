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
}

function logout() {
    localStorage.removeItem('admin_token');
    window.location.href = 'login.html';
}

// --- 2. UNIVERSAL MULTI-DELETE FUNCTION ---
// This is now available to any page that includes admin.js
function setupMultiDelete({ tableBodyId, checkAllId, deleteBtnId, apiBaseUrl, onSuccess }) {
    const tbody = document.getElementById(tableBodyId);
    const checkAll = document.getElementById(checkAllId);
    const deleteBtn = document.getElementById(deleteBtnId);

    // If elements don't exist on this page, stop immediately (prevents errors)
    if (!tbody || !deleteBtn) return;

    const getSelectedIds = () => Array.from(tbody.querySelectorAll('.row-checkbox:checked')).map(cb => cb.value);

    const updateButtonState = () => {
        const count = getSelectedIds().length;
        if (count > 0) {
            deleteBtn.style.display = 'inline-flex';
            deleteBtn.innerHTML = `<i class="bi bi-trash-fill"></i> Delete (${count})`;
        } else {
            deleteBtn.style.display = 'none';
        }
    };

    if (checkAll) {
        checkAll.addEventListener('change', (e) => {
            tbody.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = e.target.checked);
            updateButtonState();
        });
    }

    tbody.addEventListener('change', (e) => {
        if (e.target.classList.contains('row-checkbox')) {
            if (checkAll) {
                const all = tbody.querySelectorAll('.row-checkbox');
                checkAll.checked = Array.from(all).every(cb => cb.checked);
            }
            updateButtonState();
        }
    });

    deleteBtn.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if (ids.length === 0) return;
        if (!confirm(`Are you sure you want to delete ${ids.length} records?`)) return;

        deleteBtn.disabled = true;
        deleteBtn.innerText = "Processing...";
        const token = getToken();

        let successCount = 0;
        let failCount = 0;
        let errorMessages = []; // Store specific reasons

        // Loop Fetch Requests
        const deletePromises = ids.map(id => 
            fetch(`${apiBaseUrl}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    successCount++;
                } else {
                    failCount++;
                    // Capture the graceful error message
                    errorMessages.push(data.data); 
                }
            })
            .catch(err => {
                failCount++;
                errorMessages.push("Network Error");
            })
        );

        await Promise.all(deletePromises);
        
        // --- IMPROVED REPORTING ---
        let report = `Deletion Complete.\n\n✅ Deleted: ${successCount}\n❌ Failed: ${failCount}`;
        
        if (errorMessages.length > 0) {
            // Show up to 3 specific error reasons so alert isn't too huge
            const uniqueErrors = [...new Set(errorMessages)];
            report += `\n\nReasons:\n- ${uniqueErrors.slice(0, 3).join('\n- ')}`;
            if(uniqueErrors.length > 3) report += `\n...and others.`;
        }

        alert(report);
        // --------------------------

        // Reset UI
        if(checkAll) checkAll.checked = false;
        deleteBtn.style.display = 'none';
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

    // Try to run dashboard logic (will exit safely if not on dashboard)
    initDashboard();
});