const { connectDB } = require('./config/db');
const Candidate = require('./models/candidate.model');

async function checkDuplicates() {
  await connectDB();
  
  console.log("Fetching all candidates from DB...");
  const allDbCandidates = await Candidate.find({}, 'cnic rollNumber fullName').lean();
  console.log(`Total candidates in DB: ${allDbCandidates.length}`);

  const cnicCount = {};
  const rollCount = {};
  const duplicateCnics = [];
  const duplicateRolls = [];

  for (const c of allDbCandidates) {
    if (!c.cnic) continue;
    const cleanCnic = String(c.cnic).replace(/[^0-9]/g, '');
    if (!cnicCount[cleanCnic]) {
      cnicCount[cleanCnic] = { count: 1, names: [c.fullName] };
    } else {
      cnicCount[cleanCnic].count++;
      cnicCount[cleanCnic].names.push(c.fullName);
      if (cnicCount[cleanCnic].count === 2) duplicateCnics.push(cleanCnic);
    }

    if (c.rollNumber) {
      const roll = String(c.rollNumber).trim();
      if (!rollCount[roll]) {
        rollCount[roll] = { count: 1, names: [c.fullName] };
      } else {
        rollCount[roll].count++;
        rollCount[roll].names.push(c.fullName);
        if (rollCount[roll].count === 2) duplicateRolls.push(roll);
      }
    }
  }

  console.log(`\n--- DUPLICATE CNICs SUMMARY ---`);
  console.log(`Total Duplicate CNICs: ${duplicateCnics.length}`);

  console.log(`\n--- DUPLICATE ROLL NUMBERS SUMMARY ---`);
  console.log(`Total Duplicate Roll Numbers: ${duplicateRolls.length}`);

  process.exit(0);
}

checkDuplicates().catch(err => {
  console.error(err);
  process.exit(1);
});
