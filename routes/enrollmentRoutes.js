import { Router } from 'express';
import Enrollment from '../models/Enrollment.js';
import Course from '../models/Course.js';
import User from '../models/User.js';
import auth from '../middleware/auth.js';

const enrollmentRouter = Router();

//  GET /api/enrollments/my 
enrollmentRouter.get('/my', auth.protect, async (req, res) => {
    try {
        const enrollments = await Enrollment.find({ user: req.user._id })
            .populate('course', 'courseCode name uri project')
            .lean();
        res.json({ enrollments });
    } catch (err) {
        console.error('Get my enrollments error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

//  GET /api/enrollments/my/:courseCode 
enrollmentRouter.get('/my/:courseCode', auth.protect, async (req, res) => {
    try {
        const course = await Course.findOne({
            courseCode: req.params.courseCode.toUpperCase(),
        });
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const enrollment = await Enrollment.findOne({
            user: req.user._id,
            course: course._id,
        }).populate('course', 'courseCode name uri project');

        if (!enrollment) {
            return res.status(404).json({ message: 'Not enrolled in this course' });
        }

        res.json(enrollment);
    } catch (err) {
        console.error('Get enrollment error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

//  POST /api/enrollments/join 
enrollmentRouter.post('/join', auth.protect, async (req, res) => {
    const { courseCode, group } = req.body;

    if (!courseCode || !group) {
        return res.status(400).json({ message: 'courseCode and group are required' });
    }

    const validGroups = ['group-a', 'group-b', 'group-c'];
    if (!validGroups.includes(group)) {
        return res.status(400).json({ message: `group must be one of: ${validGroups.join(', ')}` });
    }

    try {
        const course = await Course.findOne({ courseCode: courseCode.toUpperCase() });
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const enrollment = await Enrollment.findOneAndUpdate(
            { user: req.user._id, course: course._id },
            {
                group,
                projectStatus: 'in-progress',
                projectStartedAt: new Date(),
            },
            { upsert: true, new: true }
        ).populate('course', 'courseCode name uri project');

        res.status(201).json({ enrollment });
    } catch (err) {
        console.error('Join enrollment error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

//  GET /api/enrollments  (admin) 
enrollmentRouter.get('/', auth.protect, auth.adminOnly, async (req, res) => {
    try {
        const filter = {};

        if (req.query.course) {
            const course = await Course.findOne({
                courseCode: req.query.course.toUpperCase(),
            });
            if (course) filter.course = course._id;
        }

        if (req.query.group) filter.group = req.query.group;

        const enrollments = await Enrollment.find(filter)
            .populate('user', 'username email role')
            .populate('course', 'courseCode name project')
            .sort({ createdAt: -1 })
            .lean();

        res.json({ enrollments, total: enrollments.length });
    } catch (err) {
        console.error('List enrollments error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

//  POST /api/enrollments  (admin) 
enrollmentRouter.post('/', auth.protect, auth.adminOnly, async (req, res) => {
    const { email, courseCode, group } = req.body;

    if (!email || !courseCode || !group) {
        return res.status(400).json({ message: 'email, courseCode and group are required' });
    }

    try {
        const [user, course] = await Promise.all([
            User.findOne({ email }),
            Course.findOne({ courseCode: courseCode.toUpperCase() }),
        ]);

        if (!user) return res.status(404).json({ message: `No user found with email: ${email}` });
        if (!course) return res.status(404).json({ message: `No course found: ${courseCode}` });

        const enrollment = await Enrollment.findOneAndUpdate(
            { user: user._id, course: course._id },
            { group, projectStatus: 'in-progress', projectStartedAt: new Date() },
            { upsert: true, new: true }
        )
            .populate('user', 'username email role')
            .populate('course', 'courseCode name project');

        res.status(201).json({ enrollment });
    } catch (err) {
        console.error('Admin enroll error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

//  PATCH /api/enrollments/:id  (admin) 
enrollmentRouter.patch('/:id', auth.protect, auth.adminOnly, async (req, res) => {
    const { group, projectStatus } = req.body;

    try {
        const update = {};
        if (group) update.group = group;
        if (projectStatus) {
            update.projectStatus = projectStatus;
            if (projectStatus === 'completed') {
                update.projectCompletedAt = new Date();
            }
        }

        const enrollment = await Enrollment.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true }
        )
            .populate('user', 'username email role')
            .populate('course', 'courseCode name');

        if (!enrollment) return res.status(404).json({ message: 'Enrollment not found' });
        res.json({ enrollment });
    } catch (err) {
        console.error('Update enrollment error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

//  DELETE /api/enrollments/:id  (admin) 
enrollmentRouter.delete('/:id', auth.protect, auth.adminOnly, async (req, res) => {
    try {
        const enrollment = await Enrollment.findByIdAndDelete(req.params.id);
        if (!enrollment) return res.status(404).json({ message: 'Enrollment not found' });
        res.json({ message: 'Enrollment removed' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

export default enrollmentRouter;