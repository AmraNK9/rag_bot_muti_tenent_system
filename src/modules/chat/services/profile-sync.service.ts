import { ChatbotUser } from '../../../infrastructure/db/models';
import { redisService } from '../../../infrastructure/redis/redis.service';
import fs from 'fs';
import path from 'path';

export class ProfileSyncService {
  /**
   * Syncs the user's Telegram profile name and picture if the 7-day cache has expired.
   */
  async syncProfileIfNeeded(chatbotId: number, senderId: string, botToken: string, from: any): Promise<void> {
    if (!from) return;

    const cacheKey = `profile_synced:${chatbotId}:${senderId}`;

    try {
      // 1. Check Redis Cache
      const isSynced = await redisService.get(cacheKey);
      if (isSynced) {
        // Cache hit: Profile is already synced recently.
        return;
      }

      // 2. Cache Miss: Extract basic text info
      const firstName = from.first_name || '';
      const username = from.username || '';
      let profilePicUrl = '';

      // 3. Fetch Profile Photo from Telegram API
      try {
        const photoUrl = `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${senderId}&limit=1`;
        const photoRes = await fetch(photoUrl);
        const photoData = await photoRes.json() as any;

        if (photoData.ok && photoData.result && photoData.result.total_count > 0) {
          // Get the highest resolution of the first photo
          const photos = photoData.result.photos[0];
          const fileId = photos[photos.length - 1].file_id;

          const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
          const fileData = await fileRes.json() as any;

          if (fileData.ok && fileData.result?.file_path) {
            const telegramFilePath = fileData.result.file_path;
            const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${telegramFilePath}`;

            // Download and save locally
            const imageRes = await fetch(downloadUrl);
            const arrayBuffer = await imageRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const uploadDir = path.join(__dirname, '../../../../uploads/avatars');
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }

            const fileName = `bot_${chatbotId}_user_${senderId}.jpg`;
            const filePath = path.join(uploadDir, fileName);
            fs.writeFileSync(filePath, buffer);

            profilePicUrl = `/uploads/avatars/${fileName}`;
          }
        }
      } catch (err) {
        console.error(`[ProfileSync] Failed to fetch or download profile photo for ${senderId}:`, err);
      }

      // 4. Upsert ChatbotUser in DB
      let user = await ChatbotUser.findOne({
        where: { chatbot_id: chatbotId, sender_id: senderId }
      });

      const updatedProfileData = {
        first_name: firstName,
        username: username,
        profile_pic_url: profilePicUrl
      };

      if (user) {
        // Merge with existing profile data just in case there are other custom fields
        const existingData = user.profile_data || {};
        await user.update({
          profile_data: { ...existingData, ...updatedProfileData },
          updated_at: new Date()
        });
      } else {
        await ChatbotUser.create({
          chatbot_id: chatbotId,
          sender_id: senderId,
          profile_data: updatedProfileData,
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      // 5. Set Redis Cache with 7 Days TTL (604800 seconds)
      await redisService.set(cacheKey, 'true', { EX: 604800 });
      console.log(`[ProfileSync] Synced and cached profile for chatbot=${chatbotId}, sender=${senderId} for 7 days.`);

    } catch (err) {
      console.error(`[ProfileSync] Error syncing profile for chatbot=${chatbotId}, sender=${senderId}:`, err);
    }
  }
}
