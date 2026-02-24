// ================================================
// FILE: public/js/users.js
// ================================================
const API_BASE = '/api/users';

function getToken() {
    return localStorage.getItem('admin_token');
}

// Quick JWT Decoder to get current logged in User ID
function parseJwt(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
}

async function fetchUsers() {
    try {
        const result = await fetchData(API_BASE, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        
        if (result.success) {
            renderTable(result.data);
        } else {
            console.error(result.data);
        }
    } catch (err) {
        console.error("Offline & No Cache:", err);
        document.getElementById('users-body').innerHTML = '<tr><td colspan="6" class="text-center">No offline data available.</td></tr>';
    }
}

function renderTable(users) {
    const token = getToken();
    const currentUser = parseJwt(token);
    const currentRole = currentUser ? currentUser.role : '';
    const currentUserId = currentUser ? currentUser.id : null;

    const tbody = document.getElementById('users-body');
    tbody.innerHTML = users.map(u => {
        const isOwner = u.role === 'Owner';
        const isSelf = u.id === currentUserId;
        
        // Rules
        const canEdit = isOwner ? (currentRole === 'Owner') : true; // Only Owner edits Owner
        const canDelete = !isOwner && !isSelf; // Cannot delete Owner, cannot delete Self

        return `
        <tr>
            <td>#${u.id}</td>
            <td><strong>${u.username} ${isSelf ? '<span style="font-size:0.7rem; color:#10b981; margin-left:5px;">(You)</span>' : ''}</strong></td>
            <td>${u.email}</td>
            <td>
                <span class="badge" style="background:${u.role === 'Owner' ? '#fef2f2' : '#eee'}; color:${u.role === 'Owner' ? '#ef4444' : '#333'};">
                    ${u.role}
                </span>
            </td>
            <td>${new Date(u.created_at).toLocaleDateString()}</td>
            <td>
                ${canEdit ? `
                <button onclick="editUser(${u.id}, '${u.username}', '${u.email}', '${u.role}', ${isSelf})" class="btn-action" style="color:#2b6cb0; margin-right:10px;" title="Edit">
                    <i class="bi bi-pencil-square"></i>
                </button>
                ` : `<span class="badge" style="background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; margin-right:10px;">Protected</span>`}
                
                ${canDelete ? `
                <button onclick="deleteUser(${u.id})" class="btn-action" style="color:#c53030;" title="Delete">
                    <i class="bi bi-trash-fill"></i>
                </button>
                ` : ''}
            </td>
        </tr>
    `}).join('');
}

// --- MODAL & FORM LOGIC ---

window.openModal = () => {
    document.getElementById('user-modal').style.display = 'flex';
    document.getElementById('user-form').reset();
    document.getElementById('user-id').value = '';
    document.getElementById('modal-title').innerText = 'Add User';
    
    // Ensure "Owner" isn't an option for new users
    const roleSelect = document.getElementById('user-role');
    roleSelect.disabled = false;
    [...roleSelect.options].forEach(opt => { if(opt.value === 'Owner') opt.remove(); });
    roleSelect.value = 'Admin';
    
    const passInput = document.getElementById('user-password');
    passInput.required = true; 
    document.getElementById('pass-hint').innerText = "Required for new users.";
}

// Notice the new 'isSelf' parameter
window.editUser = (id, username, email, role, isSelf) => {
    document.getElementById('user-modal').style.display = 'flex';
    document.getElementById('modal-title').innerText = 'Edit User';
    document.getElementById('user-id').value = id;
    document.getElementById('user-username').value = username;
    document.getElementById('user-email').value = email;
    
    const roleSelect = document.getElementById('user-role');
    
    if (role === 'Owner') {
        if (![...roleSelect.options].some(opt => opt.value === 'Owner')) {
            roleSelect.add(new Option('Owner', 'Owner'));
        }
        roleSelect.value = 'Owner';
        roleSelect.disabled = true; // Lock dropdown completely
    } else {
        roleSelect.disabled = false;
        [...roleSelect.options].forEach(opt => { if(opt.value === 'Owner') opt.remove(); });
        roleSelect.value = role;

        // If user is editing themselves, disable role changing
        if (isSelf) {
            roleSelect.disabled = true;
        }
    }
    
    const passInput = document.getElementById('user-password');
    passInput.value = ''; 
    passInput.required = false;
    document.getElementById('pass-hint').innerText = "Leave blank to keep current password.";
}

window.closeModal = () => {
    document.getElementById('user-modal').style.display = 'none';
}

window.deleteUser = async (id) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
        const res = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const result = await res.json();
        
        if (result.success) {
            alert("User deleted.");
            fetchUsers();
        } else {
            alert(result.data);
        }
    } catch (err) {
        console.error(err);
        alert("Error deleting user.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchUsers();

    // Form Submit Handler
    document.getElementById('user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('user-id').value;
        const username = document.getElementById('user-username').value;
        const email = document.getElementById('user-email').value;
        const role = document.getElementById('user-role').value;
        const password = document.getElementById('user-password').value;

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/${id}` : API_BASE;
        
        // Build payload
        const payload = { username, email, role };
        if (password) payload.password = password;

        try {
            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            
            if (result.success) {
                closeModal();
                fetchUsers();
            } else {
                alert(result.data);
            }
        } catch (err) {
            console.error(err);
            alert("Operation failed.");
        }
    });
});