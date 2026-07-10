const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');
const csv = require('csv-parser');

const files = [
  path.join(__dirname, 'exports_secure', 'studants.xlsx'),
  path.join(__dirname, 'exports_secure', 'lahore.xlsx'),
  path.join(__dirname, 'exports_secure', 'candidates.csv')
];

let totalRows = 0;
const cnics = new Set();
const rolls = new Set();

async function processCSV(filePath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        totalRows++;
        let cnic = row['cnic'] || row['CNIC'] || row['Cnic'];
        let roll = row['rollNumber'] || row['RollNumber'] || row['Roll Number'];
        if (cnic) cnics.add(String(cnic).replace(/[^0-9]/g, ''));
        if (roll) rolls.add(String(roll).trim());
      })
      .on('end', resolve)
      .on('error', reject);
  });
}

function processExcel(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  totalRows += data.length;
  for (const row of data) {
    let cnic = row['cnic'] || row['CNIC'] || row['Cnic'] || row['CNIC Number'];
    let roll = row['rollNumber'] || row['RollNumber'] || row['Roll Number'];
    if (cnic) cnics.add(String(cnic).replace(/[^0-9]/g, ''));
    if (roll) rolls.add(String(roll).trim());
  }
}

async function run() {
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.log(`File not found: ${file}`);
      continue;
    }
    console.log(`Processing ${path.basename(file)}...`);
    if (file.endsWith('.csv')) {
      await processCSV(file);
    } else {
      processExcel(file);
    }
  }

  console.log(`\n--- Analysis Result ---`);
  console.log(`Total rows across all files (including duplicates): ${totalRows}`);
  console.log(`Total unique students (by CNIC): ${cnics.size}`);
}

run();
