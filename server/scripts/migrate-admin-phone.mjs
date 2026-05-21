// One-off: migrate the admin's phone number in the database.
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { config } from '../src/config.js';

const OLD = process.argv[2] || '+254700000000';
const NEW = process.argv[3] || config.admin.phone;

await mongoose.connect(config.mongoUri);
const res = await User.updateOne({ phone: OLD }, { $set: { phone: NEW } });
console.log(`matched=${res.matchedCount} modified=${res.modifiedCount}`);
console.log(`OLD ${OLD} → NEW ${NEW}`);
await mongoose.disconnect();
