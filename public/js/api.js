// (APPLICANT) Submit Application
export async function submitApplication(formData) {
    const response = await fetch('/api/apply', {
        method: 'POST',
        body: formData // Fetch handles Content-Type for FormData
    });

    const result = await response.json();
    if(!result.success) {
        throw new Error(result.data);
    }

    return result.data;
}
// (APPLICANT) Check Status
export async function checkApplicationStatus(email) {
    // Using encodeURIComponent to handle special characters in email
    const response = await fetch(`/api/status?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    const result = await response.json();
    if(!result.success) {
        throw new Error(result.data);
    }

    return result.data;
}