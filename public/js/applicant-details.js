// public/js/applicant-details.js

// 1. Get ID from URL
const params = new URLSearchParams(window.location.search);
const id = params.get('id');

// 2. Auth Check
const token = localStorage.getItem('admin_token');
if (!token) window.location.href = 'login.html';

async function loadApplicant() {
    if (!id) {
        alert("No applicant ID provided");
        window.location.href = 'applicants.html';
        return;
    }

    try {
        // Fetch data using the existing status endpoint (it returns full details)
        const res = await fetch(`/api/status?id=${id}`, {
            headers: { 'Authorization': `Bearer ${token}` } // Pass token even if public endpoint, good practice
        });
        const json = await res.json();

        if (json.success) {
            const app = json.data;
            
            // --- POPULATE HEADER ---
            document.getElementById('app-name').textContent = `${app.first_name} ${app.last_name}`;
            document.getElementById('app-position').textContent = app.position_applied;
            
            const statusBadge = document.getElementById('app-status');
            statusBadge.textContent = app.status;
            statusBadge.className = `badge badge-${app.status.toLowerCase().replace(' ', '-')}`;

            // --- POPULATE PERSONAL INFO ---
            document.getElementById('personal-info').innerHTML = `
                <div class="info-group"><span class="info-label">Email</span><span class="info-value">${app.email}</span></div>
                <div class="info-group"><span class="info-label">Mobile</span><span class="info-value">${app.contact_num}</span></div>
                <div class="info-group"><span class="info-label">Gender</span><span class="info-value">${app.gender}</span></div>
                <div class="info-group"><span class="info-label">Birthdate</span><span class="info-value">${app.birthdate}</span></div>
                <div class="info-group"><span class="info-label">Address</span><span class="info-value" style="grid-column: span 2;">${app.address}</span></div>
            `;

            // --- POPULATE JOB INFO ---
            document.getElementById('job-info').innerHTML = `
                <div class="info-group"><span class="info-label">Applied For</span><span class="info-value">${app.position_applied}</span></div>
                <div class="info-group"><span class="info-label">Experience</span><span class="info-value">${app.years_experience} Years</span></div>
                <div class="info-group"><span class="info-label">Prev. Employer</span><span class="info-value">${app.previous_employer || 'N/A'}</span></div>
                <div class="info-group"><span class="info-label">Applied Date</span><span class="info-value">${new Date(app.created_at).toLocaleDateString()}</span></div>
            `;

            // --- DOCUMENTS ---
            document.getElementById('resume-link').href = app.resume_path;
            document.getElementById('id-img').src = app.id_image_path;

            // --- SETUP BUTTONS ---
            setupButtons(app.id);
        } else {
            alert('Applicant not found');
        }
    } catch (err) {
        console.error(err);
        alert('Error loading details');
    }
}

function setupButtons(id) {
    const updateStatus = async (newStatus) => {
        if(!confirm(`Mark this applicant as ${newStatus}?`)) return;

        try {
            const res = await fetch(`/api/applicants/${id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            const json = await res.json();
            if(json.success) {
                alert('Status updated!');
                location.reload();
            } else {
                alert(json.data);
            }
        } catch(err) {
            console.error(err);
            alert("Request failed");
        }
    };

    document.getElementById('btn-hire').onclick = () => updateStatus('Hired');
    document.getElementById('btn-interview').onclick = () => updateStatus('For Interview');
    document.getElementById('btn-reject').onclick = () => updateStatus('Rejected');
}

// Run on load
document.addEventListener('DOMContentLoaded', loadApplicant);