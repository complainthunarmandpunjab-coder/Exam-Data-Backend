/**
 * Migration Script: Convert disk-stored profile images to base64 in MongoDB
 * 
 * RUN THIS ON THE PRODUCTION SERVER (Hostinger) where the image files exist.
 * Command: node scripts/migrate-images-to-base64.js
 * 
 * What it does:
 * 1. Finds all candidates whose profileImage is a file path (e.g. /uploads/student_xxx.jpg)
 * 2. Reads the image file from disk
 * 3. Converts to base64 and stores directly in MongoDB
 * 4. After this, slips will show photos on any server
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI;

async function migrateImages() {
    console.log('\n🚀 Starting Image Migration: Disk → MongoDB base64\n');
    
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ MongoDB Connected\n');
        
        const db = mongoose.connection;
        const collection = db.collection('candidates');
        
        // Find all candidates with file-path based images (not base64, not empty)
        const candidates = await collection.find({
            profileImage: { 
                $exists: true, 
                $ne: '', 
                $regex: /^\/uploads\// 
            }
        }).toArray();
        
        console.log(`📋 Found ${candidates.length} candidates with disk-stored images\n`);
        
        let success = 0;
        let failed = 0;
        let skipped = 0;
        
        for (const candidate of candidates) {
            const filePath = path.join(__dirname, '../public', candidate.profileImage);
            
            if (!fs.existsSync(filePath)) {
                console.log(`⚠️  SKIP  ${candidate.rollNumber} — file not found: ${filePath}`);
                skipped++;
                continue;
            }
            
            try {
                const fileBuffer = fs.readFileSync(filePath);
                const base64 = `data:image/jpeg;base64,${fileBuffer.toString('base64')}`;
                
                await collection.updateOne(
                    { _id: candidate._id },
                    { $set: { profileImage: base64 } }
                );
                
                console.log(`✅ OK    ${candidate.rollNumber} — ${candidate.fullName} (${Math.round(base64.length / 1024)} KB)`);
                success++;
            } catch (err) {
                console.log(`❌ FAIL  ${candidate.rollNumber} — ${err.message}`);
                failed++;
            }
        }
        
        console.log('\n─────────────────────────────────────────');
        console.log(`✅ Migrated:  ${success} candidates`);
        console.log(`⚠️  Skipped:   ${skipped} candidates (file not found on disk)`);
        console.log(`❌ Failed:    ${failed} candidates`);
        console.log('─────────────────────────────────────────\n');
        
        if (success > 0) {
            console.log('🎉 Migration complete! Now all student slips will show photos.\n');
        }
        
    } catch (err) {
        console.error('❌ Migration Error:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

migrateImages();
