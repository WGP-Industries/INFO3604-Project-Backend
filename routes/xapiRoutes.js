import { Router } from 'express';
import auth from '../middleware/auth.js';
import {
    submitStatement,
    getMyStatements,
    getAdminStatements,
    getAdminStats,
} from '../controllers/xapiController.js';

const xapiRouter = Router();

xapiRouter.post('/', auth.protect, submitStatement);
xapiRouter.get('/statements', auth.protect, getMyStatements);
xapiRouter.get('/admin/statements', auth.protect, auth.adminOnly, getAdminStatements);
xapiRouter.get('/admin/stats', auth.protect, auth.adminOnly, getAdminStats);

export default xapiRouter;