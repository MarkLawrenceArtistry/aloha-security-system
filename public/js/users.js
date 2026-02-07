// ================================================
// FILE: public/js/users.js
// ================================================
const API_BASE = '/api/users';

function getToken() {
    return localStorage.getItem('admin_token');
}

async function fetchUsers() {
    try {
        const res = await fetch(API_BASE, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const result = await res.json();
        
        if (result.success) {
            renderTable(result.data);
        } else {
            console.error(result.data);
        }
    } catch (err) {
        console.error(err);
    }
}

function renderTable(users) {
    const tbody = document.getElementById('users-body');
    tbody.innerHTML = users.map(u => `
        <tr>
            <td>#${u.id}</td>
            <td><strong>${u.username}</strong></td>
            <td>${u.email}</td>
            <td><span class="badge" style="background:#eee; color:#333;">${u.role}</span></td>
            <td>${new Date(u.created_at).toLocaleDateString()}</td>
            <td>
                <button onclick="editUser(${u.id}, '${u.username}', '${u.email}', '${u.role}')" class="btn-action" style="color:#2b6cb0; margin-right:10px;">
                    <i class="bi bi-pencil-square"></i>
                </button>
                <button onclick="deleteUser(${u.id})" class="btn-action" style="color:#c53030;">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// --- MODAL & FORM LOGIC ---

window.openModal = () => {
    document.getElementById('user-modal').style.display = 'flex';
    document.getElementById('user-form').reset();
    document.getElementById('user-id').value = '';
    document.getElementById('modal-title').innerText = 'Add User';
    
    // Force password to be required for new users
    const passInput = document.getElementById('user-password');
    passInput.required = true; 
    document.getElementById('pass-hint').innerText = "Required for new users.";
}

window.closeModal = () => {
    document.getElementById('user-modal').style.display = 'none';
}

window.editUser = (id, username, email, role) => {
    document.getElementById('user-modal').style.display = 'flex';
    document.getElementById('modal-title').innerText = 'Edit User';
    document.getElementById('user-id').value = id;
    document.getElementById('user-username').value = username;
    document.getElementById('user-email').value = email;
    document.getElementById('user-role').value = role;
    
    // Password is optional during edit
    const passInput = document.getElementById('user-password');
    passInput.value = ''; // Clear it
    passInput.required = false;
    document.getElementById('pass-hint').innerText = "Leave blank to keep current password.";
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