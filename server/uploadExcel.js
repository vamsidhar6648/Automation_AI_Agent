// server/uploadExcel.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseExcelToJSON } = require('./utils/excelParser');
const { toCamelCase } = require('./utils/normalizer');

const router = express.Router();

// Ensure temp directory exists
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
    console.log(`INFO: Creating temp directory for uploads: ${tempDir}`);
    fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, tempDir),
    filename: (_, file, cb) =>
        cb(null, `uploaded_${Date.now()}${path.extname(file.originalname)}`) // Unique filename
});
const upload = multer({ storage });

// This endpoint receives the uploaded Excel file and initial selections
router.post('/', upload.single('excel'), async (req, res) => {
    if (!req.file) {
        console.error('Upload Error: No Excel file received by Multer.');
        return res.status(400).json({ success: false, error: '❌ No Excel file uploaded. Please select a file.' });
    }

    const filePath = req.file.path;
    try {
        const tool = req.body.tool;
        const language = req.body.language;
        // Normalize the project name to ensure it's file-system friendly
        const userProject = toCamelCase(req.body.projectName?.trim() || 'ai-gen-default');

        if (!tool || !language) {
            fs.unlink(filePath, (err) => { if (err) console.error(`Error deleting temp file on missing params ${filePath}:`, err); });
            return res.status(400).json({ success: false, error: '❌ Missing tool or language selection. Please ensure they are selected on the UI.' });
        }

        console.log(`DEBUG: Received uploaded file: ${filePath}`);
        console.log(`DEBUG: Tool selected: "${tool}", Language selected: "${language}", Project Name: "${userProject}"`);

        const parsedData = await parseExcelToJSON(filePath);
        console.log(`DEBUG: Parsed Excel Data Size (Number of Scenarios): ${parsedData.size}`);
        console.log(`DEBUG: Parsed Excel Data (first entry, truncated):`, JSON.stringify(Array.from(parsedData.entries()).slice(0, 1)).substring(0, Math.min(JSON.stringify(Array.from(parsedData.entries()).slice(0, 1)).length, 500)) + '...');
    
        res.json({
            success: true,
            message: '✅ Excel parsed successfully. Ready for code generation.',
            // IMPORTANT: Convert the Map's values to an Array before sending to client
            parsedExcelData: Array.from(parsedData.values()), 
            projectName: userProject,
            selectedTool: tool,
            selectedLanguage: language
        });

        fs.unlink(filePath, (err) => {
            if (err) console.error(`Error deleting temporary file ${filePath}:`, err);
            else console.log(`DEBUG: Deleted temporary file: ${filePath}`);
        });

    } catch (err) {
        console.error('Excel Upload/Parsing Error:', err);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error(`Error deleting temporary file on error ${req.file.path}:`, unlinkErr);
            });
        }
        res.status(500).json({ success: false, error: `❌ Failed to parse Excel file: ${err.message}. Please check its format.` });
    }
});

module.exports = router;