require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
try {
  const osServers = dns.getServers().filter(s => s !== '127.0.0.1' && s !== '::1');
  const targetServers = osServers.length > 0 ? [...osServers, '8.8.8.8', '1.1.1.1'] : ['8.8.8.8', '1.1.1.1'];
  dns.setServers(targetServers);
} catch (err) {}

const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI;

const candidatesToReset = [
  "Muhammad Subhan",
  "Muhammad hammad",
  "Muhammad Ali",
  "Shagufta Madad",
  "FARHAN KHAN SULTAN",
  "SHAHZAD AHMAD SHAHEEN",
  "Ali Shan",
  "Alveera",
  "Zainab Ilyas",
  "Amaima",
  "Hiba Khalid",
  "muhammad danish",
  "Awais Ashraf",
  "YUMNA IRFAN",
  "Muhammad Ahmad",
  "MUHAMMAD ARHAM",
  "Sultan Shahzad Awan",
  "Saba Naz",
  "Muhammad Samiullah",
  "Laiqa Arooj",
  "Abadat Ali",
  "EMAN KHALID"
];

async function resetSlips() {
    try {
        await mongoose.connect(MONGODB_URI);
        const db = mongoose.connection;
        const collection = db.collection('candidates');
        
        const result = await collection.updateMany(
            { fullName: { $in: candidatesToReset } },
            { $set: { slipGenerated: false, slipGeneratedAt: null } }
        );
        
        console.log(`Successfully reset ${result.modifiedCount} candidates.`);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

resetSlips();
