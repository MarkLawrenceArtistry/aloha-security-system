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
        if (!navigator.onLine) {
            alert("Action unavailable while offline.");
            return;
        }

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

function applyRBAC() {
    const role = localStorage.getItem('admin_role'); // We will save this on login
    
    // Elements to hide for Non-Admins
    const protectedLinks = [
        'users.html',
        'audit-log.html'
    ];

    if (role !== 'Admin') {
        // 1. Remove Sidebar Links
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const href = item.getAttribute('href');
            if (href && protectedLinks.includes(href)) {
                item.style.display = 'none';
            }
        });

        // 2. Hide Delete Buttons on Applicant/Branch pages (Optional stricter UI)
        const deleteActions = document.getElementById('delete-actions');
        if(deleteActions) deleteActions.style.display = 'none !important';
    }
}

// --- 4. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Run Auth Check
    checkAuth();
    applyRBAC();

    // 2. Logout Handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // --- NEW: MOBILE MENU LOGIC ---
    const mainContent = document.querySelector('.main-content');
    const sidebar = document.querySelector('.sidebar');
    
    if (mainContent && sidebar) {
        // A. Inject Mobile Header Button
        const mobileHeader = document.createElement('div');
        mobileHeader.className = 'mobile-header';
        mobileHeader.innerHTML = `
            <div class="mobile-logo">ALOHA <span>ADMIN</span></div>
            <button class="mobile-toggle-btn"><i class="bi bi-list"></i></button>
        `;
        // Insert at the very top of main-content
        mainContent.insertBefore(mobileHeader, mainContent.firstChild);

        // B. Inject Overlay
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);

        // C. Toggle Logic
        const toggleBtn = mobileHeader.querySelector('.mobile-toggle-btn');
        
        function toggleSidebar() {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        }

        toggleBtn.addEventListener('click', toggleSidebar);
        overlay.addEventListener('click', toggleSidebar); // Close when clicking outside

        // Close sidebar when clicking a link (optional, good for UX)
        sidebar.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if(window.innerWidth <= 991) toggleSidebar();
            });
        });
    }
    // --- END MOBILE MENU LOGIC ---

    // 4. Login Form Handler (Existing)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // Disable button to prevent double-clicks
            const btn = loginForm.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = "Checking...";
            btn.disabled = true;

            try {
                const res = await fetch('/api/auth/login', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const json = await res.json();

                if (json.success) {
                    localStorage.setItem('admin_token', json.data.token);
                    localStorage.setItem('admin_role', json.data.user.role); 
                    window.location.href = 'admin-dashboard.html';
                } else {
                    // --- THE FIX IS HERE ---
                    // Display the ACTUAL message from the server (json.data)
                    // instead of a hardcoded "Login failed"
                    alert(json.data); 
                }
            } catch (err) {
                console.error(err);
                alert("Connection error. Is the server running?");
            } finally {
                // Re-enable button
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }
    
    // 5. Init Dashboard
    initDashboard();



    // --- SLEEK OFFLINE INDICATOR ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        .offline-pill {
            position: fixed; bottom: 24px; left: 24px;
            background: #232323; color: #fff;
            padding: 12px 20px; border-radius: 30px;
            font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600;
            display: flex; align-items: center; gap: 10px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            z-index: 999999;
            transform: translateY(100px); opacity: 0; visibility: hidden;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .offline-pill.show { transform: translateY(0); opacity: 1; visibility: visible; }
        .offline-pill.online-flash { background: #10b981; }
        .offline-pill i { font-size: 1.1rem; }
        @media (max-width: 768px) {
            .offline-pill { bottom: 20px; left: 50%; transform: translateX(-50%) translateY(100px); width: max-content; }
            .offline-pill.show { transform: translateX(-50%) translateY(0); }
        }
    `;
    document.head.appendChild(styleSheet);

    // B. Create Element
    const offlinePill = document.createElement('div');
    offlinePill.className = 'offline-pill';
    document.body.appendChild(offlinePill);

    // C. Logic
    const updateOnlineStatus = () => {
        if (!navigator.onLine) {
            // OFFLINE STATE
            offlinePill.innerHTML = '<i class="bi bi-wifi-off" style="color:#f59e0b;"></i> <span>You are currently offline.</span>';
            offlinePill.classList.remove('online-flash');
            offlinePill.classList.add('show');
        } else {
            // BACK ONLINE STATE (Flash Green)
            if (offlinePill.classList.contains('show')) {
                offlinePill.innerHTML = '<i class="bi bi-wifi" style="color:white;"></i> <span>Back online.</span>';
                offlinePill.classList.add('online-flash');
                setTimeout(() => {
                    offlinePill.classList.remove('show');
                }, 3000);
            }
        }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Check on Load
    if (!navigator.onLine) updateOnlineStatus();

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('SW Registered'))
                .catch(err => console.error('SW Fail', err));
        });
    }


    // ============================================================
    // 1. AFK AUTO-LOGOUT SYSTEM (30 Minutes)
    // ============================================================
    let afkTimer;
    const AFK_LIMIT = 30 * 60 * 1000; // 30 Minutes

    function resetAfkTimer() {
        clearTimeout(afkTimer);
        if (localStorage.getItem('admin_token')) { // Only run if logged in
            afkTimer = setTimeout(() => {
                alert("Session expired due to inactivity.");
                logout();
            }, AFK_LIMIT);
        }
    }

    // Listen for user activity to reset the timer
    window.onload = resetAfkTimer;
    document.onmousemove = resetAfkTimer;
    document.onkeypress = resetAfkTimer;
    document.onclick = resetAfkTimer;
    document.onscroll = resetAfkTimer;


    // ============================================================
    // 2. SMART FETCH (Network First -> LocalStorage Fallback)
    // ============================================================
    window.fetchData = async function(url, options = {}) {
        const storageKey = 'cache_' + url; // Unique key for every API call

        try {
            // A. Try Network
            const response = await fetch(url, options);
            if (!response.ok) throw new Error("Network response was not ok");
            
            const result = await response.json();

            // B. If success, save to LocalStorage (Overwrite old data)
            if (result.success) {
                try {
                    localStorage.setItem(storageKey, JSON.stringify(result));
                    console.log(`Saved live data to ${storageKey}`);
                } catch (e) {
                    console.warn("LocalStorage full, could not cache data");
                }
            }
            return result;

        } catch (err) {
            // C. If Network Fails (Offline), try LocalStorage
            console.warn("Network failed, checking LocalStorage...");
            const cached = localStorage.getItem(storageKey);

            if (cached) {
                // Trigger the Offline Toast specifically for Data
                const offlinePill = document.querySelector('.offline-pill');
                if(offlinePill) {
                    offlinePill.innerHTML = '<i class="bi bi-database-check"></i> <span>Viewing offline data</span>';
                    offlinePill.classList.add('show');
                }
                return JSON.parse(cached);
            }

            // D. If neither works, throw error
            throw err;
        }
    };
});