// ================================================
// FILE: src/middleware/upload.js
// ================================================
const multer = require('multer');
const path = require('path');

// Use the same logic as server.js to determine the destination
const BASE_PATH = process.env.VOLUME_PATH || path.join(__dirname, '../../public');
const UPLOAD_PATH = path.join(BASE_PATH, 'uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Point multer to the correct path (volume in production, local folder in dev)
        cb(null, UPLOAD_PATH);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

function checkFileType(file, cb) {
  // Added PDF/DOC for Resumes
  const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images or Documents Only!');
  }
}

const upload = multer({
  storage: storage,
  limits: { fileSize: 10000000 },
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  }
});

module.exports = upload;