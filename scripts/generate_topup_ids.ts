import { SequelizeService } from '../src/infrastructure/db/sequelize.service';
import { Business } from '../src/infrastructure/db/models';

function generateUID(): string {
  // Base58 omitting 0, O, I, 1
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let uid = '';
  for (let i = 0; i < 6; i++) {
    uid += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `UID-${uid}`;
}

async function migrate() {
  try {
    await SequelizeService.connect();
    
    const businesses = await Business.findAll({ where: { topup_id: null } });
    console.log(`Found ${businesses.length} businesses without topup_id`);
    
    for (const business of businesses) {
      let isUnique = false;
      let newUid = '';
      while (!isUnique) {
        newUid = generateUID();
        const existing = await Business.findOne({ where: { topup_id: newUid } });
        if (!existing) {
          isUnique = true;
        }
      }
      
      business.topup_id = newUid;
      await business.save();
      console.log(`Assigned ${newUid} to Business ID: ${business.id}`);
    }
    
    console.log('Migration completed successfully.');
    await SequelizeService.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
