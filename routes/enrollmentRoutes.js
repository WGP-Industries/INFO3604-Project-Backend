import { Router } from 'express';
import auth from '../middleware/auth.js';
import {
    getMyEnrollments,
    getMyEnrollmentByCourse,
    joinGroup,
    getAllEnrollments,
    enrollStudent,
    bulkEnroll,
    updateEnrollment,
    deleteEnrollment,
} from '../controllers/enrollmentController.js';

const enrollmentRouter = Router();

enrollmentRouter.get('/my', auth.protect, getMyEnrollments);
enrollmentRouter.get('/my/:courseCode', auth.protect, getMyEnrollmentByCourse);
enrollmentRouter.post('/join', auth.protect, joinGroup);
enrollmentRouter.get('/', auth.protect, auth.adminOnly, getAllEnrollments);
enrollmentRouter.post('/', auth.protect, auth.adminOnly, enrollStudent);
enrollmentRouter.post('/bulk', auth.protect, auth.adminOnly, bulkEnroll);
enrollmentRouter.patch('/:id', auth.protect, auth.adminOnly, updateEnrollment);
enrollmentRouter.delete('/:id', auth.protect, auth.adminOnly, deleteEnrollment);

export default enrollmentRouter;