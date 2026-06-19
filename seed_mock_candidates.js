const mongoose = require('mongoose');
const Candidate = require('./models/candidate.model');
const { connectDB } = require('./config/db');

const seedData = async () => {
  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log('Clearing existing candidates...');
    await Candidate.deleteMany({});

    console.log('Generating 50,000 mock candidates...');
    const cities = ['Lahore (nearest areas)', 'Faisalabad', 'Multan', 'Islamabad', 'Sialkot', 'Gujranwala'];
    const courses = ['GRAPHIC DESIGNING', 'UIUX DESIGNING', 'IELTS', 'MERN STACK DEVELOPMENT', 'PYTHON PROGRAMIING'];
    const genders = ['Male', 'Female'];
    const batches = ['Batch 1', 'Batch 2'];

    const bulkBatchSize = 10000;
    for (let batchIdx = 0; batchIdx < 5; batchIdx++) {
      const candidates = [];
      for (let i = 0; i < bulkBatchSize; i++) {
        const id = batchIdx * bulkBatchSize + i;
        candidates.push({
          fullName: `Student Name ${id}`,
          fatherName: `Father Name ${id}`,
          cnic: `35201-${String(1000000 + id)}-1`,
          email: `student_${id}@example.com`,
          contactNumber: `0300${String(1000000 + id)}`,
          gender: genders[Math.floor(Math.random() * genders.length)],
          city: cities[Math.floor(Math.random() * cities.length)],
          preferredExamCity: cities[Math.floor(Math.random() * cities.length)],
          district: 'Lahore',
          tehsil: 'Lahore Cantt',
          institute: 'Punjab IT Academy',
          batch: batches[Math.floor(Math.random() * batches.length)],
          course: courses[Math.floor(Math.random() * courses.length)],
          rollNumber: `HP-${String(20260000 + id)}`,
          verificationStatus: Math.random() > 0.3 ? 'verified' : 'unverified',
          status: Math.random() > 0.2 ? 'Approved' : 'Pending',
          isDeleted: false
        });
      }
      
      console.log(`Inserting batch ${batchIdx + 1}/5 (${bulkBatchSize} records)...`);
      await Candidate.insertMany(candidates);
    }

    console.log('✓ Seeding complete! 50,000 candidates successfully inserted.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedData();
