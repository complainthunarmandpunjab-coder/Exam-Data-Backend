const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { connectDB } = require('./config/db');
const Candidate = require('./models/candidate.model');

async function checkMissingCandidates() {
  await connectDB();
  
  const csvPath = path.join(__dirname, 'exports_secure', 'candidates.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found!');
    process.exit(1);
  }

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let isFirstLine = true;
  let cnicIndex = -1;
  let rollNumberIndex = -1;
  let nameIndex = -1;
  
  const csvCandidates = [];

  for await (const line of rl) {
    // Basic CSV parse (assuming no commas inside quotes for CNIC/RollNumber)
    // For robust parsing, we handle quotes
    const row = line.match(/(?<=^|,)(?:"([^"]*)"|([^,]*))/g)?.map(val => {
      if (val && val.startsWith('"') && val.endsWith('"')) {
        return val.slice(1, -1);
      }
      return val || '';
    });
    
    if (!row) continue;

    if (isFirstLine) {
      cnicIndex = row.findIndex(col => col.toLowerCase() === 'cnic');
      rollNumberIndex = row.findIndex(col => col.toLowerCase() === 'rollnumber');
      nameIndex = row.findIndex(col => col.toLowerCase() === 'fullname');
      isFirstLine = false;
      continue;
    }

    if (cnicIndex !== -1 && row[cnicIndex]) {
      csvCandidates.push({
        cnic: row[cnicIndex].replace(/[^0-9]/g, ''),
        rollNumber: rollNumberIndex !== -1 ? row[rollNumberIndex] : '',
        name: nameIndex !== -1 ? row[nameIndex] : ''
      });
    }
  }

  console.log(`Total candidates in CSV: ${csvCandidates.length}`);

  let missingCount = 0;
  const missingCandidates = [];

  // Batch query to DB for faster checking
  const allDbCandidates = await Candidate.find({}, 'cnic rollNumber').lean();
  const dbCnicSet = new Set(allDbCandidates.map(c => c.cnic ? String(c.cnic).replace(/[^0-9]/g, '') : ''));
  const dbRollSet = new Set(allDbCandidates.map(c => c.rollNumber));

  for (const csvCand of csvCandidates) {
    if (!dbCnicSet.has(csvCand.cnic) && (!csvCand.rollNumber || !dbRollSet.has(csvCand.rollNumber))) {
      missingCandidates.push(csvCand);
      missingCount++;
    }
  }

  console.log(`\nFound ${missingCount} candidates in CSV that are NOT in the Database:\n`);
  
  if (missingCount > 0) {
    missingCandidates.forEach((c, idx) => {
      console.log(`${idx + 1}. Name: ${c.name}, CNIC: ${c.cnic}, RollNumber: ${c.rollNumber}`);
    });
  } else {
    console.log("All candidates in the CSV exist in the Database!");
  }

  process.exit(0);
}

checkMissingCandidates().catch(err => {
  console.error(err);
  process.exit(1);
});
