// ================================================
// FILE: public/js/main.js
// ================================================
import * as api from './api.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM ELEMENTS ---
    const checkStatusBtns = document.querySelectorAll('.check-status-action');
    const appForm = document.querySelector('#multi-step-form');
    
    // --- LANDING PAGE LOGIC ---
    if(checkStatusBtns.length > 0) {
        checkStatusBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const email = prompt("Enter your email address to check status:");
                if (email) {
                    try {
                        const data = await api.checkApplicationStatus(email);
                        alert(`Hi ${data.first_name}, your application status is: ${data.status}`);
                    } catch (err) {
                        alert(`Error: ${err.message}`);
                    }
                }
            });
        });
    }

    // --- APPLICATION FORM LOGIC ---
    if(appForm) {
        const preSubmitBtn = document.getElementById('btn-pre-submit');
        const modal = document.getElementById('privacy-modal');
        const finalSubmitBtn = document.getElementById('btn-final-submit');
        const closeModalBtn = document.getElementById('btn-modal-close');

        // 1. Initial "Proceed" Click
        preSubmitBtn.addEventListener('click', () => {
            // Check Consent Checkboxes
            const consentTruth = document.getElementById('consent_truth').checked;
            const consentBg = document.getElementById('consent_bg_check').checked;
            const consentDrug = document.getElementById('consent_drug_test').checked;

            if(!consentTruth || !consentBg || !consentDrug) {
                alert("Please acknowledge all consent declarations (checkboxes) to proceed.");
                // Highlight the missing ones visually
                document.querySelectorAll('.consent-section input[type="checkbox"]:not(:checked)').forEach(el => {
                    el.style.outline = "2px solid red";
                    setTimeout(() => el.style.outline = "none", 2000);
                });
                return;
            }

            // Show Modal
            modal.classList.add('active');
        });

        // 2. "Review Again" Click (Close Modal)
        closeModalBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        // 3. Close on background click
        modal.addEventListener('click', (e) => {
            if(e.target === modal) modal.classList.remove('active');
        });

        // 4. FINAL "Accept & Submit" Click
        finalSubmitBtn.addEventListener('click', async () => {
            // UI State: Loading
            finalSubmitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';
            finalSubmitBtn.disabled = true;
            closeModalBtn.disabled = true;

            const formData = new FormData(appForm);

            try {
                // Submit to API
                const result = await api.submitApplication(formData);
                
                // Success State
                modal.classList.remove('active'); // Hide modal
                localStorage.removeItem('aloha_application_draft'); // Clear draft
                alert(`Application Submitted! Your ID is: ${result.applicant_id}`);
                window.location.href = `status-result.html?email=${encodeURIComponent(formData.get('email'))}`;

            } catch (err) {
                console.error(err);
                alert(`Error: ${err.message}`);
                
                // Reset Button State on Error
                finalSubmitBtn.innerHTML = 'Accept & Submit Application';
                finalSubmitBtn.disabled = false;
                closeModalBtn.disabled = false;
                modal.classList.remove('active'); // Optional: hide modal on error to let them fix stuff
            }
        });
    }

    if (window.location.pathname.includes('application.html')) {
        // 1. Inject styles directly to bypass Service Worker cache issues
        if (!document.getElementById('offline-pill-styles')) {
            const style = document.createElement('style');
            style.id = 'offline-pill-styles';
            style.innerHTML = `
                .offline-pill {
                    position: fixed; bottom: 24px; left: 24px;
                    background: #232323; color: #fff;
                    padding: 12px 20px; border-radius: 30px;
                    font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600;
                    display: flex; align-items: center; gap: 10px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                    z-index: 999999;
                    transform: translateY(150px); opacity: 0; visibility: hidden;
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .offline-pill.show { transform: translateY(0); opacity: 1; visibility: visible; }
                .offline-pill.online-flash { background: #10b981; }
                @media (max-width: 768px) {
                    .offline-pill { bottom: 20px; left: 50%; transform: translateX(-50%) translateY(150px); width: max-content; max-width: 90%; }
                    .offline-pill.show { transform: translateX(-50%) translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }

        const offlinePill = document.createElement('div');
        offlinePill.className = 'offline-pill';
        offlinePill.innerHTML = '<i class="bi bi-wifi-off" style="color:#f59e0b;"></i> <span>You are currently offline.</span>';
        document.body.appendChild(offlinePill);

        const updateOnlineStatus = () => {
            if (!navigator.onLine) {
                offlinePill.innerHTML = '<i class="bi bi-wifi-off" style="color:#f59e0b;"></i> <span>You are currently offline.</span>';
                offlinePill.classList.remove('online-flash');
                offlinePill.classList.add('show');
            } else {
                if (offlinePill.classList.contains('show')) {
                    offlinePill.innerHTML = '<i class="bi bi-cloud-check-fill"></i> <span>Back online.</span>';
                    offlinePill.classList.add('online-flash');
                    setTimeout(() => offlinePill.classList.remove('show'), 3000);
                }
            }
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        if (!navigator.onLine) updateOnlineStatus();
    }
});