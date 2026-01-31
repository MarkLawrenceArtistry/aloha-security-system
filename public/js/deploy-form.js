const API_BASE = '/api';

function getToken() {
    return localStorage.getItem('admin_token');
}

async function loadData() {
    const token = getToken();

    try {
        const [appRes, branchRes] = await Promise.all([
            fetch(`${API_BASE}/applicants?status=Hired`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_BASE}/branches?limit=100`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const appData = await appRes.json();
        const branchData = await branchRes.json();

        const appSelect = document.getElementById('applicant-select');
        const branchSelect = document.getElementById('branch-select');

        // Populate Applicants
        if(appData.success && appData.data.length > 0) {
            appSelect.innerHTML = '<option value="" disabled selected>Select a Guard</option>' + 
                appData.data.map(a => `<option value="${a.id}">${a.first_name} ${a.last_name} (${a.position_applied})</option>`).join('');
        } else {
            appSelect.innerHTML = '<option value="" disabled>No Hired applicants available</option>';
        }

        // Populate Branches
        if(branchData.success && branchData.data.branches.length > 0) {
            branchSelect.innerHTML = '<option value="" disabled selected>Select a Branch</option>' + 
                branchData.data.branches.map(b => `<option value="${b.id}">${b.name} - ${b.location}</option>`).join('');
        } else {
            branchSelect.innerHTML = '<option value="" disabled>No branches created yet</option>';
        }

    } catch (err) {
        console.error("Error loading form data", err);
        alert("Failed to load data. Please ensure you are logged in.");
    }
}

document.getElementById('deploy-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const applicant_id = document.getElementById('applicant-select').value;
    const branch_id = document.getElementById('branch-select').value;
    const btn = e.target.querySelector('button');

    if(!applicant_id || !branch_id) {
        alert("Please select both a guard and a branch.");
        return;
    }

    btn.innerText = "Deploying...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/deployments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ applicant_id, branch_id })
        });

        const result = await res.json();

        if(result.success) {
            alert('Guard Deployed Successfully!');
            window.location.href = 'deployment.html';
        } else {
            alert(result.data); // Error message
            btn.innerText = "Confirm Deployment";
            btn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        alert('Deployment failed');
    }
});

document.addEventListener('DOMContentLoaded', loadData);