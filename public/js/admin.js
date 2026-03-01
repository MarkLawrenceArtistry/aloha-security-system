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

window.fetchData = async function(url, options = {}) {
    const storageKey = 'cache_' + url; 

    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error("Network response was not ok");
        
        const result = await response.json();

        if (result.success) {
            try {
                localStorage.setItem(storageKey, JSON.stringify(result));
            } catch (e) {
                console.warn("LocalStorage full, could not cache data");
            }
        }
        return result;

    } catch (err) {
        console.warn(`Network failed for ${url}, checking LocalStorage...`);
        const cached = localStorage.getItem(storageKey);

        if (cached) {
            const pill = document.querySelector('.offline-pill');
            if(pill) {
                pill.innerHTML = '<i class="bi bi-database"></i> <span>Viewing offline data</span>';
                pill.classList.add('show');
            }
            return JSON.parse(cached);
        }
        throw err;
    }
};

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

            if (data.system_health) {
                document.getElementById('sh-uptime').innerText = data.system_health.uptime;
                document.getElementById('sh-dbsize').innerText = data.system_health.db_size + ' MB';
                document.getElementById('sh-backup').innerText = data.system_health.last_backup;
                document.getElementById('sh-maintenance').innerText = data.system_health.next_maintenance;
                if(document.getElementById('sh-purge')) document.getElementById('sh-purge').innerText = data.system_health.next_purge;
            }
            
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

window.parseJwt = function(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
};

// --- 2. REPLACE renderChart() in admin.js ---
function renderChart(chartData) {
    const container = document.getElementById('chart-bars');
    if (!container) return;
    
    if (!chartData || chartData.length === 0) {
        container.innerHTML = '<p style="text-align:center; width:100%; color:#999; align-self:center; margin-top:80px;"><i class="bi bi-inbox" style="font-size:2rem; display:block; margin-bottom:10px;"></i>No data available yet</p>';
        return;
    }
    
    const maxVal = Math.max(...chartData.map(d => d.count)) || 1;
    // FIX: Only show midVal if maxVal is greater than 1, otherwise leave it blank
    const midVal = maxVal > 1 ? Math.round(maxVal / 2) : '';

    const yAxis = `
        <div style="display: flex; flex-direction: column; justify-content: space-between; height: 220px; padding-right: 15px; border-right: 2px solid #cbd5e1; color: #64748b; font-size: 0.75rem; font-weight: 700; text-align: right; margin-bottom: 27px;">
            <span>${maxVal}</span>
            <span>${midVal}</span>
            <span>0</span>
        </div>
    `;

    const bars = chartData.map(d => {
        const date = new Date(d.month + '-01'); 
        const label = date.toLocaleString('default', { month: 'short' });
        const height = (d.count / maxVal) * 90; 
        return `
            <div class="bar-group">
                <div class="bar-bg">
                    <div class="bar" style="height: ${height}%;" title="${d.count} Applications"></div>
                </div>
                <span class="bar-label">${label}</span>
            </div>`;
    }).join('');

    container.innerHTML = yAxis + `<div style="display: flex; flex: 1; justify-content: space-around; align-items: flex-end;">${bars}</div>`;
}

function applyRBAC() {
    const role = localStorage.getItem('admin_role'); 
    
    const protectedLinks = ['users.html', 'audit-log.html'];

    if (role !== 'Admin' && role !== 'Owner') {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const href = item.getAttribute('href');
            if (href && protectedLinks.includes(href)) {
                item.style.display = 'none';
            }
        });

        // Hide anything marked admin-only
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'none !important';
            el.parentNode.removeChild(el); // Completely remove it from DOM to be safe
        });
    }
}

// --- 4. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Run Auth Check
    checkAuth();
    applyRBAC();

    const token = getToken();
    if (token) {
        const user = window.parseJwt(token);
        if (user) {
            const userLabel = document.createElement('div');
            userLabel.style = "padding: 12px 15px; margin: auto 15px 15px 15px; background: rgba(255,255,255,0.03); border-radius: 10px; font-size: 0.8rem; color: #94a3b8; border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; line-height: 1.4;";
            
            // Color code the role
            let roleColor = '#3b82f6'; // Staff
            if(user.role === 'Admin') roleColor = '#f59e0b';
            if(user.role === 'Owner') roleColor = '#ef4444';

            userLabel.innerHTML = `
                <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px;">Logged in as</span>
                <strong style="color: white; font-size: 0.95rem;">${user.username}</strong>
                <span style="color: ${roleColor}; font-weight: 700; margin-top: 2px;">
                    <i class="bi bi-shield-lock-fill"></i> ${user.role}
                </span>
            `;

            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn && logoutBtn.parentNode) {
                // Push the logout button to the absolute bottom, put user label right above it
                logoutBtn.style.marginTop = "0"; 
                userLabel.style.marginTop = "auto"; 
                logoutBtn.parentNode.insertBefore(userLabel, logoutBtn);
            }
        }
    }

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

    if (!document.querySelector('.offline-pill')) {
        const offlinePill = document.createElement('div');
        offlinePill.className = 'offline-pill';
        document.body.appendChild(offlinePill);
    }

    const offlinePill = document.querySelector('.offline-pill');

    const updateOnlineStatus = () => {
        if (!navigator.onLine) {
            // --- WENT OFFLINE ---
            offlinePill.innerHTML = '<i class="bi bi-wifi-off" style="color:#f59e0b;"></i> <span>You are currently offline.</span>';
            offlinePill.classList.remove('online-flash');
            offlinePill.classList.add('show');
            
            // Disable buttons that require network
            document.querySelectorAll('button[type="submit"], .btn-action').forEach(btn => btn.disabled = true);
        } else {
            // --- CAME ONLINE ---
            if (offlinePill.classList.contains('show')) {
                offlinePill.innerHTML = '<i class="bi bi-cloud-check-fill"></i> <span>Connection restored. Refreshing...</span>';
                offlinePill.classList.add('online-flash');
                
                // Re-enable buttons
                document.querySelectorAll('button[type="submit"], .btn-action').forEach(btn => btn.disabled = false);

                // AUTO REFRESH DATA LOGIC
                // We check if specific page fetch functions exist and run them
                console.log("Network restored: Refreshing data...");
                
                if (typeof initDashboard === 'function') initDashboard(); // Dashboard
                if (typeof fetchApplicants === 'function') fetchApplicants(); // Applicants
                if (typeof fetchBranches === 'function') fetchBranches(); // Branches
                if (typeof fetchDeployments === 'function') fetchDeployments(); // Deployment
                if (typeof fetchRoster === 'function') fetchRoster(); // Roster
                if (typeof fetchUsers === 'function') fetchUsers(); // Users
                if (typeof fetchLogs === 'function') fetchLogs(); // Audit

                setTimeout(() => {
                    offlinePill.classList.remove('show');
                }, 3000);
            }
        }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Check status immediately on load
    if (!navigator.onLine) updateOnlineStatus();

    // ============================================================
    // 4. SMART FETCH (Network First -> LocalStorage Fallback)
    // ============================================================

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('SW Registered'))
                .catch(err => console.error('SW Fail', err));
        });
    }


    



    // ============================================================
    // 1. ROBUST REAL-TIME SESSION TIMEOUT SYSTEM
    // ============================================================
    const isLoginPage = window.location.pathname.includes('login.html');
    if (!isLoginPage && localStorage.getItem('admin_token')) {
        const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 Minutes
        const WARNING_THRESHOLD_MS = 60 * 1000; // 60 seconds
        
        let sessionExpiry = Date.now() + SESSION_DURATION_MS;
        let tickerInterval;

        // Inject Modal HTML dynamically
        if(!document.getElementById('session-modal')) {
            document.body.insertAdjacentHTML('beforeend', `
                <div id="session-modal" class="session-modal-overlay" style="z-index: 2147483647;">
                    <div class="session-modal-box">
                        <div class="session-icon"><i class="bi bi-hourglass-split"></i></div>
                        <h2 style="margin:0 0 10px 0; color:#0f172a; font-weight:800;">Are you still there?</h2>
                        <p style="color:#64748b; margin-bottom:30px; line-height:1.5;">
                            For security, your session will expire in <strong id="countdown-timer" style="color:#f97316; font-size:1.2rem;">60</strong> seconds.
                        </p>
                        <button id="btn-stay-active" class="btn-stay-login">
                            <i class="bi bi-arrow-repeat"></i> I'm still working
                        </button>
                    </div>
                </div>
            `);
        }

        const sessionModal = document.getElementById('session-modal');
        const stayActiveBtn = document.getElementById('btn-stay-active');
        const modalCountdownEl = document.getElementById('countdown-timer');
        const dashboardTimerEl = document.getElementById('sh-session-timer');

        function formatTime(ms) {
            if (ms < 0) ms = 0;
            const totalSeconds = Math.floor(ms / 1000);
            return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
        }

        function tick() {
            if (!localStorage.getItem('admin_token')) return;

            const timeLeft = sessionExpiry - Date.now();

            if (dashboardTimerEl) {
                dashboardTimerEl.innerText = formatTime(timeLeft);
                dashboardTimerEl.style.color = timeLeft <= WARNING_THRESHOLD_MS ? '#ef4444' : '#ffffff';
            }

            if (timeLeft <= 0) {
                // Anti-sleep logic: If browser slept and skipped the warning, give them 15 seconds to react now
                if (!sessionModal.classList.contains('active')) {
                    sessionExpiry = Date.now() + 15000; 
                    sessionModal.classList.add('active');
                } else {
                    // Time actually ran out while modal was open
                    clearInterval(tickerInterval);
                    sessionModal.classList.remove('active');
                    // NO ALERT, JUST LOGOUT SILENTLY
                    localStorage.removeItem('admin_token');
                    window.location.href = 'login.html'; 
                }
            } else if (timeLeft <= WARNING_THRESHOLD_MS) {
                if (!sessionModal.classList.contains('active')) sessionModal.classList.add('active');
                if (modalCountdownEl) modalCountdownEl.innerText = Math.ceil(timeLeft / 1000);
            } else {
                if (sessionModal.classList.contains('active')) sessionModal.classList.remove('active');
            }
        }

        if (stayActiveBtn) {
            stayActiveBtn.addEventListener('click', () => {
                sessionExpiry = Date.now() + SESSION_DURATION_MS;
                sessionModal.classList.remove('active');
                tick(); 
            });
        }

        let throttleTimer;
        ['mousemove', 'keypress', 'click', 'scroll'].forEach(evt => {
            document.addEventListener(evt, () => {
                if (sessionModal.classList.contains('active')) return;
                if (!throttleTimer) {
                    throttleTimer = setTimeout(() => {
                        sessionExpiry = Date.now() + SESSION_DURATION_MS;
                        throttleTimer = null;
                    }, 1000);
                }
            });
        });

        tickerInterval = setInterval(tick, 1000);
        tick();
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            // Check if Logout Modal is active
            const logoutModal = document.getElementById('custom-logout-modal');
            if (logoutModal && logoutModal.classList.contains('active')) {
                e.preventDefault(); // Prevent default form submissions
                const confirmBtn = document.getElementById('confirm-logout');
                if (confirmBtn) confirmBtn.click();
            }
        }
    });

    window.globalToast = function(title, message, type = 'info') {
        let container = document.getElementById('global-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'global-toast-container';
            container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 999999; display: flex; flex-direction: column; gap: 10px;';
            document.body.appendChild(container);
        }

        const colors = { success: '#10b981', info: '#3b82f6', warning: '#f59e0b', error: '#ef4444' };
        const color = colors[type] || colors.info;

        const toast = document.createElement('div');
        toast.style.cssText = `
            background: white; border-left: 4px solid ${color}; padding: 15px 20px;
            border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            display: flex; flex-direction: column; min-width: 250px;
            transform: translateX(120%); transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        `;
        toast.innerHTML = `
            <strong style="color: #0f172a; font-size: 0.9rem;">${title}</strong>
            <span style="color: #64748b; font-size: 0.8rem; margin-top: 4px;">${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Animate In
        requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });

        // Animate Out & Remove
        setTimeout(() => {
            toast.style.transform = 'translateX(120%)';
            setTimeout(() => toast.remove(), 400);
        }, 5000);
    };

    // Connect Socket ONLY if logged in
    if (!isLoginPage && localStorage.getItem('admin_token') && typeof io !== 'undefined') {
        const socket = io();
        
        socket.on('connect', () => console.log('🟢 Real-time Socket Connected'));
        
        socket.on('new_application', (data) => {
            // Show Notification
            globalToast('🔔 New Application Received!', `${data.name} just applied for ${data.position}`, 'info');

            // Auto-refresh tables if the function exists on the current page
            if (typeof initDashboard === 'function') initDashboard();
            if (typeof fetchApplicants === 'function') {
                currentPage = 1; // Reset to page 1 to see the newest app
                fetchApplicants();
            }
        });
    }
});