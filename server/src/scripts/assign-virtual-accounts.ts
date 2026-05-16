
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('MONGODB_URI not set in .env');
  process.exit(1);
}

function generateSquadVirtualAccount() {
  // Squad virtual accounts are typically 10-digit NUBAN numbers.
  // We'll generate a random 10-digit number.
  // Often they start with '0' or '9' depending on the partner bank (e.g. Providus, Sterling).
  // The examples in docs showed "0712714141", "0740379575", "9013151600".
  
  const prefix = Math.random() > 0.5 ? '0' : '9';
  const rest = Math.floor(Math.random() * 900000000) + 100000000; // 9 digits
  return `${prefix}${rest}`;
}

async function run() {
  try {
    await mongoose.connect(MONGO_URI as string);
    console.log('Connected to MongoDB');

    const employeesCol = mongoose.connection.collection('employees');
    const employees = await employeesCol.find({}).toArray();

    console.log(`Found ${employees.length} employees to update.`);

    let updatedCount = 0;
    for (const emp of employees) {
      const virtualAccount = generateSquadVirtualAccount();
      await employeesCol.updateOne(
        { _id: emp._id },
        { $set: { accountNumber: virtualAccount } }
      );
      updatedCount++;
    }

    console.log(`Successfully assigned virtual accounts to ${updatedCount} employees.`);
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error assigning virtual accounts:', error);
    process.exit(1);
  }
}

run();
