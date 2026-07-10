require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
try {
  const osServers = dns.getServers().filter(s => s !== '127.0.0.1' && s !== '::1');
  const targetServers = osServers.length > 0 ? [...osServers, '8.8.8.8', '1.1.1.1'] : ['8.8.8.8', '1.1.1.1'];
  dns.setServers(targetServers);
} catch (err) {}

const mongoose = require('mongoose');
const environment = require('./config/environment');
const Candidate = require('./models/candidate.model');

async function cleanCnicDashes() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(environment.mongodbUri);
        console.log('Database connected.');

        const candidatesToUpdate = await Candidate.find({
            cnic: { $regex: '-' },
            slipGenerated: false,
            isDeleted: { $ne: true }
        });

        console.log('Found ' + candidatesToUpdate.length + ' candidates with dashes in CNIC whose slips are to be generated.');

        let updatedCount = 0;

        for (const candidate of candidatesToUpdate) {
            const originalCnic = candidate.cnic;
            const cleanedCnic = originalCnic.replace(/-/g, '');
            
            if (cleanedCnic) {
                try {
                    await Candidate.updateOne({ _id: candidate._id }, { $set: { cnic: cleanedCnic } });
                    console.log('Updated CNIC from ' + originalCnic + ' to ' + cleanedCnic);
                    updatedCount++;
                } catch (updateErr) {
                    if (updateErr.code === 11000) {
                        console.log('⚠️ SKIPPED duplicate CNIC: ' + cleanedCnic + ' (Original: ' + originalCnic + ')');
                    } else {
                        console.error('Error updating ' + originalCnic, updateErr);
                    }
                }
            }
        }

        console.log('Successfully updated ' + updatedCount + ' records.');

    } catch (error) {
        console.error('Error occurred:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Database disconnected.');
    }
}

cleanCnicDashes();
