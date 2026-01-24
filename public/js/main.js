import * as api from './api.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM ELEMENTS ---
    const checkStatusBtns = document.querySelectorAll('.check-status-action'); // Class for any button that checks status
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
        const nextBtns = document.querySelectorAll('.btn-next');
        const prevBtns = document.querySelectorAll('.btn-prev');
        const steps = document.querySelectorAll('.form-step');
        const indicators = document.querySelectorAll('.stepper .step');
        const stepLabel = document.querySelector('#current-step-label');

        // Next Step Logic
        nextBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const currentStepNum = parseInt(e.target.dataset.step); // e.g., 1
                const nextStepNum = currentStepNum + 1;

                // Validation
                const currentDiv = document.querySelector(`#step-${currentStepNum}`);
                const inputs = currentDiv.querySelectorAll('input[required], select[required], textarea[required]');
                let valid = true;

                inputs.forEach(input => {
                    if (!input.value) {
                        valid = false;
                        input.style.borderColor = 'red';
                    } else {
                        input.style.borderColor = '#ccc';
                    }
                });

                if (!valid) {
                    alert("Please fill in all required fields.");
                    return;
                }

                // Switch UI
                changeStep(currentStepNum, nextStepNum);

                // If moving to Review Step (Step 4), populate data
                if (nextStepNum === 4) {
                    populateReviewSection();
                }
            });
        });

        // Previous Step Logic
        prevBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const currentStepNum = parseInt(e.target.dataset.step); // e.g., 2
                const prevStepNum = currentStepNum - 1;
                changeStep(currentStepNum, prevStepNum);
            });
        });

        // UI Helper
        function changeStep(from, to) {
            // Hide current
            document.querySelector(`#step-${from}`).classList.remove('active-step');
            document.querySelector(`#step-ind-${from}`).classList.remove('active'); // Indicator
            
            // Show next
            document.querySelector(`#step-${to}`).classList.add('active-step');
            document.querySelector(`#step-ind-${to}`).classList.add('active'); // Indicator

            if(stepLabel) stepLabel.innerText = to;
        }

        // Review Helper
        function populateReviewSection() {
            const formData = new FormData(appForm);
            const list = document.querySelector('#review-list');
            list.innerHTML = '';
            
            list.innerHTML += `<li><strong>Name:</strong> ${formData.get('first_name')} ${formData.get('last_name')}</li>`;
            list.innerHTML += `<li><strong>Email:</strong> ${formData.get('email')}</li>`;
            list.innerHTML += `<li><strong>Mobile:</strong> ${formData.get('contact_num')}</li>`;
            list.innerHTML += `<li><strong>Position:</strong> ${formData.get('position_applied')}</li>`;
        }

        // Form Submit
        appForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = appForm.querySelector('button[type="submit"]');
            
            submitBtn.innerText = "Submitting...";
            submitBtn.disabled = true;

            const formData = new FormData(appForm);

            try {
                const result = await api.submitApplication(formData);
                alert(`Application Submitted! Your ID is: ${result.applicant_id}`);
                window.location.href = 'index.html';
            } catch (err) {
                console.error(err);
                alert(`Error: ${err.message}`);
                submitBtn.innerText = "Submit Application";
                submitBtn.disabled = false;
            }
        });
    }
});