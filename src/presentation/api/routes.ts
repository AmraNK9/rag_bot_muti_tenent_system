import { Router } from 'express';
import { router as totalAdminRoutes } from './routes/total-admin.routes';
import { router as chatbotAdminRoutes } from './routes/chatbot-admin.routes';
import { router as resellerRoutes } from './routes/reseller.routes';
import { router as subscriptionRoutes } from './routes/subscription.routes';
import { router as systemRoutes } from './routes/system.routes';

const apiRouter = Router();

apiRouter.use('/', totalAdminRoutes);
apiRouter.use('/', chatbotAdminRoutes);
apiRouter.use('/', resellerRoutes);
apiRouter.use('/', subscriptionRoutes);
apiRouter.use('/', systemRoutes);

export default apiRouter;
// Note: calculateCommissions is now in src/modules/subscription/commission.utils.ts
