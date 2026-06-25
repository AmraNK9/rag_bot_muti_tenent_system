import cron from 'node-cron';
import { Op } from 'sequelize';
import { Reseller } from '../../infrastructure/db/models';

export function startResellerCronJobs() {
  // Run every day at 11:59 PM (23:59)
  cron.schedule('59 23 * * *', async () => {
    console.log('[Cron] Running daily reseller debt check...');
    try {
      // Find all resellers with pending_debt > 0
      const resellersToSuspend = await Reseller.findAll({
        where: {
          pending_debt: {
            [Op.gt]: 0
          }
        }
      });

      if (resellersToSuspend.length > 0) {
        console.log(`[Cron] Found ${resellersToSuspend.length} resellers with pending debt. Suspending selling privileges...`);
        
        for (const reseller of resellersToSuspend) {
          await reseller.update({ can_sell: false });
        }
        
        console.log('[Cron] Daily reseller debt check completed successfully.');
      } else {
        console.log('[Cron] No resellers with pending debt found.');
      }
    } catch (error) {
      console.error('[Cron] Error during daily reseller debt check:', error);
    }
  });

  console.log('[Cron] Reseller cron jobs initialized.');
}
