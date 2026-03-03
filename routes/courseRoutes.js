import { Router } from 'express';
import Course from '../models/Course.js';
import Group from '../models/Group.js';
import auth from '../middleware/auth.js';

const courseRouter = Router();

// GET /api/courses
courseRouter.get('/', async (req, res) => {
    try {
        const courses = await Course.find().sort({ courseCode: 1 });
        res.json({ courses });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/courses/:courseCode
courseRouter.get('/:courseCode', async (req, res) => {
    try {
        const course = await Course.findOne({
            courseCode: req.params.courseCode.toUpperCase(),
        });
        if (!course) return res.status(404).json({ message: 'Course not found' });
        res.json({ course });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/courses/:courseCode/groups
courseRouter.get('/:courseCode/groups', async (req, res) => {
    try {
        const course = await Course.findOne({
            courseCode: req.params.courseCode.toUpperCase(),
        });
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const groups = await Group.find({ course: course._id }).sort({ name: 1 });
        res.json({ groups });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/courses/:courseCode/groups
// Any authenticated student can create a group for a course
courseRouter.post('/:courseCode/groups', auth.protect, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Group name is required' });
        }

        const course = await Course.findOne({
            courseCode: req.params.courseCode.toUpperCase(),
        });
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const slug = name.trim().toLowerCase().replace(/\s+/g, '-');

        const exists = await Group.findOne({ course: course._id, slug });
        if (exists) return res.status(400).json({ message: 'A group with that name already exists' });

        const group = await Group.create({ name: name.trim(), slug, course: course._id });

        // Return all groups for this course so the frontend can update its list in one go
        const groups = await Group.find({ course: course._id }).sort({ name: 1 });
        res.status(201).json({ group, groups });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE /api/courses/:courseCode/groups/:groupId  (admin)
courseRouter.delete('/:courseCode/groups/:groupId', auth.protect, auth.adminOnly, async (req, res) => {
    try {
        const group = await Group.findByIdAndDelete(req.params.groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        res.json({ message: 'Group removed' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default courseRouter;