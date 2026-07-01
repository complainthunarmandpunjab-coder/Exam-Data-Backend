require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function backfillExamSeq() {
    console.log('\n🚀 Starting Backfill: Assigning examSeqNumber to all candidates\n');
    
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ MongoDB Connected\n');
        
        const db = mongoose.connection;
        const collection = db.collection('candidates');
        
        // Find all distinct courses first
        const courses = await collection.distinct('course', { isDeleted: { $ne: true } });
        console.log(`📋 Found ${courses.length} distinct courses\n`);
        
        let totalSuccess = 0;
        
        for (const course of courses) {
            console.log(`Processing course: ${course}`);
            // Get all candidates for this course, ordered by registration time
            const candidates = await collection.find({ course, isDeleted: { $ne: true } })
                                             .sort({ createdAt: 1 })
                                             .toArray();
            
            let seq = 1;
            let updatedForCourse = 0;
            
            for (const candidate of candidates) {
                await collection.updateOne(
                    { _id: candidate._id },
                    { $set: { examSeqNumber: seq } }
                );
                seq++;
                updatedForCourse++;
                totalSuccess++;
            }
            console.log(`  -> Updated ${updatedForCourse} candidates for ${course}`);
        }
        
        console.log('\n─────────────────────────────────────────');
        console.log(`✅ Successfully backfilled ${totalSuccess} candidates in total.`);
        console.log('─────────────────────────────────────────\n');
        console.log('🎉 Done! Now all students will have unique Test Nos like 00001, 00002, etc.');
        
    } catch (err) {
        console.error('❌ Backfill Error:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

backfillExamSeq();
