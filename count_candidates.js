const mongoose = require('mongoose');

const uri = 'mongodb+srv://quantumbases:QB123.com.pk@hunarmand-punjab.7dbsn.mongodb.net/exam-hunarmand';

async function run() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    
    const count = await db.collection('candidates').countDocuments();
    console.log(`Total Candidates: ${count}`);
    
    // Count in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentCount = await db.collection('candidates').countDocuments({
      createdAt: { $gte: fiveMinutesAgo }
    });
    console.log(`Candidates added in the last 5 minutes: ${recentCount}`);
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
