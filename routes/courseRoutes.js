import { Router } from 'express';
import auth from '../middleware/auth.js';
import {
    getCourses,
    getCourse,
    getGroups,
    createGroup,
    bulkCreateGroups,
    deleteGroup,
} from '../controllers/courseController.js';

const courseRouter = Router();

courseRouter.get('/', getCourses);
courseRouter.get('/:courseCode', getCourse);
courseRouter.get('/:courseCode/groups', getGroups);
courseRouter.post('/:courseCode/groups', auth.protect, createGroup);
courseRouter.post('/:courseCode/groups/bulk', auth.protect, auth.adminOnly, bulkCreateGroups);
courseRouter.delete('/:courseCode/groups/:groupId', auth.protect, auth.adminOnly, deleteGroup);

export default courseRouter;