import { Router } from 'express';
import auth from '../middleware/auth.js';
import {
    register,
    login,
    getMe,
    changePassword,
    getAllUsers,
    updateRole,
    deleteUser,
} from '../controllers/userController.js';

const userRouter = Router();

userRouter.post('/register', register);
userRouter.post('/login', login);
userRouter.get('/me', auth.protect, getMe);
userRouter.patch('/me/password', auth.protect, changePassword);
userRouter.get('/all', auth.protect, auth.adminOnly, getAllUsers);
userRouter.patch('/:id/role', auth.protect, auth.adminOnly, updateRole);
userRouter.delete('/:id', auth.protect, auth.adminOnly, deleteUser);

export default userRouter;