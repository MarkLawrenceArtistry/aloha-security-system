// ================================================
// FILE: public/deploy-form.js (Corrected)
// ================================================
const API_BASE = '/api';
let searchTimeout;

// DOM Elements
const applicantSearchInput = document.getElementById('applicant-search');
const applicantIdInput = document.getElementById('applicant-id');
const applicantResultsContainer = document.getElementById('applicant-results');
const branchSelect = document.getElementById('branch-select');
const deployForm = document.getElementById('deploy-form');

function getToken() {
    return localStorage.getItem('admin_token');
}

async function loadBranches() {
    const token = getToken();
    try {
        const res = await fetch(`${API_BASE}/branches?limit=1000`, { headers: { 'Authorization': `Bearer ${token}` } });
        const branchData = await res.json();
        
        if (branchData.success && branchData.data.branches.length > 0) {
            branchSelect.innerHTML = '<option value="" disabled selected>Select a Branch</option>' + 
                branchData.data.branches.map(b => `<option value="${b.id}">${b.name} - ${b.location}</option>`).join('');
        } else {
            branchSelect.innerHTML = '<option value="" disabled>No branches created yet</option>';
        }
    } catch (err) {
        console.error("Error loading branches", err);
    }
}

async function searchApplicants(searchTerm) {
    if (searchTerm.length < 2) {
        applicantResultsContainer.innerHTML = '';
        applicantResultsContainer.style.display = 'none';
        return;
    }

    const token = getToken();
    try {
        // FIX: Added &available_only=true to the URL
        const res = await fetch(`${API_BASE}/applicants?status=Hired&available_only=true&search=${encodeURIComponent(searchTerm)}&limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        
        applicantResultsContainer.innerHTML = '';
        if (result.success && result.data.applicants.length > 0) {
            result.data.applicants.forEach(app => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.textContent = `${app.first_name} ${app.last_name} (${app.position_applied})`;
                item.dataset.id = app.id;
                item.addEventListener('click', () => {
                    applicantSearchInput.value = item.textContent;
                    applicantIdInput.value = item.dataset.id;
                    applicantResultsContainer.style.display = 'none';
                });
                applicantResultsContainer.appendChild(item);
            });
            applicantResultsContainer.style.display = 'block';
        } else {
            applicantResultsContainer.innerHTML = '<div class="search-result-item" style="color:#888;">No hired applicants found.</div>';
            applicantResultsContainer.style.display = 'block';
        }
    } catch (err) {
        console.error('Applicant search error:', err);
    }
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', loadBranches);

applicantSearchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    applicantIdInput.value = ''; // Clear ID if user is typing a new name
    searchTimeout = setTimeout(() => {
        searchApplicants(applicantSearchInput.value);
    }, 300); // Debounce API calls
});

document.addEventListener('click', (e) => {
    if (!applicantResultsContainer.contains(e.target) && e.target !== applicantSearchInput) {
        applicantResultsContainer.style.display = 'none';
    }
});

deployForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const applicant_id = applicantIdInput.value;
    const branch_id = branchSelect.value;
    const btn = e.target.querySelector('button[type="submit"]');

    if(!applicant_id || !branch_id) {
        alert("Please select both a guard and a branch.");
        return;
    }

    btn.innerText = "Deploying...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/deployments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ applicant_id, branch_id })
        });
        const result = await res.json();
        if(result.success) {
            alert('Guard Deployed Successfully!');
            window.location.href = 'deployment.html';
        } else {
            alert(result.data);
            btn.innerText = "Confirm Deployment";
            btn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        alert('Deployment failed');
        btn.innerText = "Confirm Deployment";
        btn.disabled = false;
    }
});