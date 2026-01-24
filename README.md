# 🛡️ Aloha Security Agency - Recruitment & Management System

> A centralized web-based platform to automate recruitment and organize personnel deployment for the Aloha Security Agency.

## 📖 Overview

The **Aloha Security System** bridges the gap between job seekers and agency administration. It replaces manual paper-based applications with a digital portal and provides administrators with tools to review applicants, manage security branches, and deploy personnel effectively.

## 🛠️ Tech Stack

*   **Runtime:** Node.js
*   **Framework:** Express.js
*   **Database:** SQLite3 (Serverless, local file database)
*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6 Modules)
*   **Security:** Bcrypt (Hashing), JWT (Authentication)
*   **Storage:** Local Volume Storage (Railway/Localhost)

---

## 🌟 Key Features

### 🧑‍✈️ A. Applicant Portal (Public)
*   **Multi-Step Application Form:** Guided interface for Personal Info, Position, and Experience.
*   **File Uploads:** Secure handling of Resumes (PDF/Images) and ID Photos.
*   **Smart Validation:**
    *   **Age Gating:** Automatically rejects applicants under 21 years old.
    *   **Duplicate Detection:** Prevents re-submission based on Name + Birthdate.
*   **Status Checker:** Applicants can check if they are "Pending," "Hired," or "Rejected" using their email.
*   **Offline Awareness:** Notifies users if internet connection is lost during application.

### 👮‍♂️ B. Administrative System (Internal)
*   **Secure Dashboard:** Admin login protected by JWT and hashed passwords.
*   **Recruitment Management:** View profiles, render documents in-browser, and move applicants through the workflow (Pending → Interview → Hired).
*   **Branch Management:** Create and manage client sites (e.g., "SM North").
*   **Deployment:** Assign hired guards to specific branches.
*   **Audit Logging:** Tracks all administrative actions for accountability.
*   **Automated Maintenance:** A server-side **Cron Job** automatically hard-deletes "Rejected" records and files after 72 hours to save storage space.

---

## ⚠️ Delimitations (Limitations)

*   **No Payroll/Attendance:** This system focuses solely on recruitment and deployment. It does not calculate salaries or track daily time logs.
*   **Single-Server Architecture:** Images are stored on the host server volume, not an external CDN (like AWS S3).
*   **Internal Use Only:** There is no login portal for Client companies or Security Guards; only Aloha Staff.

---

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing.

### Prerequisites
*   [Node.js](https://nodejs.org/) (v14 or higher)
*   npm (Node Package Manager)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/aloha-security-system.git
    cd aloha-security-system
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Setup Environment**
    The system uses SQLite, so no external database setup is required. However, ensure the upload directory exists:
    ```bash
    # Linux/Mac
    mkdir -p public/uploads
    
    # Windows (Command Prompt)
    mkdir public\uploads
    ```

4.  **Run the Server**
    ```bash
    # For development (with nodemon)
    npm run dev
    
    # Standard start
    npm start
    ```

5.  **Access the Application**
    Open your browser and navigate to:
    `http://localhost:3000`

---

## 📖 Usage Guide

### 1. Applying for a Job
1.  Navigate to the **Home Page**.
2.  Click **"Apply Now"** or **"Join Our Team"**.
3.  Fill out the 4-step form.
4.  Upload a dummy Resume (PDF/Image) and ID.
5.  Submit. You will receive an **Applicant ID**.

### 2. Checking Application Status
1.  On the Home Page, click **"Check Status"**.
2.  Enter the email address used during application.
3.  The system will return your current recruitment status.

### 3. Database Management
Since this uses SQLite, the database file is generated as `aloha_database.db` in the root folder upon the first run.
*   **Default Admin Credentials:**
    *   **Username:** `admin`
    *   **Password:** `Admin123!`

---

## 📂 Project Structure

```
aloha-security-system/
├── public/                 # Static files (Frontend)
│   ├── css/                # Stylesheets
│   ├── js/                 # Client-side logic (main.js, api.js)
│   ├── uploads/            # Stored Resumes and IDs
│   ├── index.html          # Landing Page
│   └── application.html    # Application Form
├── src/
│   ├── controllers/        # Business Logic
│   ├── middleware/         # File Upload (Multer)
│   ├── routes/             # API Endpoints
│   ├── utils/              # DB Helper functions
│   ├── database.js         # SQLite connection & Schema
│   └── server.js           # Entry point
├── package.json
└── README.md
```

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).