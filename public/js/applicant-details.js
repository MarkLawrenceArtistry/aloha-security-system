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
            const authQuery = `?t=${token}`;

            const resumeBtn = document.getElementById('resume-link');
            if (resumeBtn) {
                resumeBtn.href = app.resume_path + authQuery;
                resumeBtn.removeAttribute('target');
                resumeBtn.setAttribute('download', `Resume_${app.last_name}_${app.first_name}.pdf`);
            }
            
            document.getElementById('id-img').src = app.id_image_path + authQuery;

            const idDownloadBtn = document.getElementById('id-download');
            if (idDownloadBtn) {
                idDownloadBtn.href = app.id_image_path + authQuery; 
                idDownloadBtn.setAttribute('download', `ID_${app.last_name}_${app.first_name}.jpg`); 
            }

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

// --- NEW MODAL FUNCTIONS ---
function openInterviewModal() {
    document.getElementById('interview-modal').style.display = 'flex';
    document.getElementById('interview-message').value = "Please visit our main office at 108 Old Highway, Guiwan, Zamboanga City. Bring your original documents."; // Reset default
}

window.closeInterviewModal = function() {
    document.getElementById('interview-modal').style.display = 'none';
}

function setupButtons(id) {
    // Shared update status function
    const updateStatus = async (newStatus, customMessage = null) => {
        try {
            const res = await fetch(`/api/applicants/${id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus, message: customMessage }) 
            });
            const json = await res.json();
            if(json.success) {
                // If it was an interview, close modal
                if (newStatus === 'For Interview') {
                    closeInterviewModal();
                }
                alert('Status updated successfully!');
                location.reload();
            } else {
                alert(json.data);
            }
        } catch(err) {
            console.error(err);
            alert("Request failed");
        }
    };

    // 1. Hire Button
    const hireBtn = document.getElementById('btn-hire');
    if (hireBtn) {
        hireBtn.onclick = () => {
            if (confirm("Are you sure you want to HIRE this applicant? This will make them available for deployment.")) {
                updateStatus('Hired');
            }
        };
    }

    // 2. Reject Button
    const rejectBtn = document.getElementById('btn-reject');
    if (rejectBtn) {
        rejectBtn.onclick = () => {
            if (confirm("Are you sure you want to REJECT this applicant?")) {
                updateStatus('Rejected');
            }
        };
    }

    // 3. Interview Button (Opens Modal)
    const interviewBtn = document.getElementById('btn-interview');
    if (interviewBtn) {
        interviewBtn.onclick = () => {
            openInterviewModal();
        };
    }

    // 4. Modal Confirm Button
    const confirmInterviewBtn = document.getElementById('btn-confirm-interview');
    if (confirmInterviewBtn) {
        // Remove old listeners just in case
        const newBtn = confirmInterviewBtn.cloneNode(true);
        confirmInterviewBtn.parentNode.replaceChild(newBtn, confirmInterviewBtn);
        
        newBtn.addEventListener('click', () => {
            const msg = document.getElementById('interview-message').value;
            if (!msg) {
                alert("Please enter interview instructions.");
                return;
            }
            newBtn.innerHTML = "Sending...";
            newBtn.disabled = true;
            updateStatus('For Interview', msg);
        });
    }
}

// Run on load
document.addEventListener('DOMContentLoaded', loadApplicant);