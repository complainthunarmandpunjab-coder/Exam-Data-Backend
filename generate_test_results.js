require('dotenv').config();
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const config = require('./config/environment');

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
try {
  const osServers = dns.getServers().filter(s => s !== '127.0.0.1' && s !== '::1');
  const targetServers = osServers.length > 0 ? [...osServers, '8.8.8.8', '1.1.1.1'] : ['8.8.8.8', '1.1.1.1'];
  dns.setServers(targetServers);
} catch (err) {}

const Candidate = require('./models/candidate.model');

async function generate() {
  try {
    // Connect to DB directly
    await mongoose.connect(config.mongodbUri);
    console.log("Connected to DB");

    // Get 10 candidates
    const candidates = await Candidate.find({ rollNumber: { $exists: true, $ne: null } }).limit(10);
    
    if (candidates.length === 0) {
      console.log("No candidates found with a roll number.");
      process.exit(1);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Results');
    
    worksheet.addRow(['Roll Number', 'Theory Marks', 'Practical Marks']);
    
    const randomMarks = [40, 50, 15, 30, 55, 45, 25, 35, 60, 20];
    
    candidates.forEach((c, index) => {
      const marks = randomMarks[index % randomMarks.length];
      worksheet.addRow([c.rollNumber, marks, 0]);
      console.log(`Added ${c.rollNumber} with ${marks} marks`);
    });
    
    const dir = path.join(__dirname, 'exports_secure');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    
    const filePath = path.join(dir, 'test_results.xlsx');
    await workbook.xlsx.writeFile(filePath);
    
    console.log(`Successfully generated excel sheet at ${filePath}`);
    process.exit(0);
  } catch (error) {
    console.error("Error generating sheet:", error);
    process.exit(1);
  }
}

generate();
