import { Router } from 'express';
import Enrollment from '../models/Enrollment.js';
import Course from '../models/Course.js';
import Group from '../models/Group.js';
import User from '../models/User.js';
import auth from '../middleware/auth.js';

const enrollmentRouter = Router();

const populateEnrollment = (query) =>
    query
        .populate('course', 'courseCode name uri project')
        .populate('group', 'name slug');

// GET /api/enrollments/my
enrollmentRouter.get('/my', auth.protect, async (req, res) => {
    try {
        const enrollments = await populateEnrollment(
            Enrollment.find({ user: req.user._id })
        ).lean();
        res.json({ enrollments });
    } catch (err) {
        console.error('Get my enrollments error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/enrollments/my/:courseCode
enrollmentRouter.get('/my/:courseCode', auth.protect, async (req, res) => {
    try {
        const course = await Course.findOne({
            courseCode: req.params.courseCode.toUpperCase(),
        });
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const enrollment = await populateEnrollment(
            Enrollment.findOne({ user: req.user._id, course: course._id })
        );
        if (!enrollment) return res.status(404).json({ message: 'Not enrolled in this course' });

        res.json(enrollment);
    } catch (err) {
        console.error('Get enrollment error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/enrollments/join
// Body: { courseCode, groupId }  — groupId is the Group ObjectId
enrollmentRouter.post('/join', auth.protect, async (req, res) => {
    const { courseCode, groupId } = req.body;

    if (!courseCode || !groupId) {
        return res.status(400).json({ message: 'courseCode and groupId are required' });
    }

    try {
        const course = await Course.findOne({ courseCode: courseCode.toUpperCase() });
        if (!course) return res.status(404).json({ message: 'Course not found' });

        // Confirm the group belongs to this course
        const group = await Group.findOne({ _id: groupId, course: course._id });
        if (!group) return res.status(400).json({ message: 'Group does not belong to this course' });

        const enrollment = await populateEnrollment(
            Enrollment.findOneAndUpdate(
                { user: req.user._id, course: course._id },
                { group: group._id, projectStatus: 'in-progress', projectStartedAt: new Date() },
                { upsert: true, new: true }
            )
        );

        res.status(201).json({ enrollment });
    } catch (err) {
        console.error('Join enrollment error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/enrollments  (admin)
enrollmentRouter.get('/', auth.protect, auth.adminOnly, async (req, res) => {
    try {
        const filter = {};

        if (req.query.course) {
            const course = await Course.findOne({ courseCode: req.query.course.toUpperCase() });
            if (course) filter.course = course._id;
        }
        if (req.query.group) filter.group = req.query.group; // expects ObjectId string

        const enrollments = await Enrollment.find(filter)
            .populate('user', 'username email role')
            .populate('course', 'courseCode name project')
            .populate('group', 'name slug')
            .sort({ createdAt: -1 })
            .lean();

        res.json({ enrollments, total: enrollments.length });
    } catch (err) {
        console.error('List enrollments error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/enrollments  (admin)
// Body: { email, courseCode, groupId }
enrollmentRouter.post('/', auth.protect, auth.adminOnly, async (req, res) => {
    const { email, courseCode, groupId } = req.body;

    if (!email || !courseCode || !groupId) {
        return res.status(400).json({ message: 'email, courseCode and groupId are required' });
    }

    try {
        const [user, course] = await Promise.all([
            User.findOne({ email }),
            Course.findOne({ courseCode: courseCode.toUpperCase() }),
        ]);

        if (!user) return res.status(404).json({ message: `No user found with email: ${email}` });
        if (!course) return res.status(404).json({ message: `No course found: ${courseCode}` });

        const group = await Group.findOne({ _id: groupId, course: course._id });
        if (!group) return res.status(400).json({ message: 'Group does not belong to this course' });

        const enrollment = await Enrollment.findOneAndUpdate(
            { user: user._id, course: course._id },
            { group: group._id, projectStatus: 'in-progress', projectStartedAt: new Date() },
            { upsert: true, new: true }
        )
            .populate('user', 'username email role')
            .populate('course', 'courseCode name project')
            .populate('group', 'name slug');

        res.status(201).json({ enrollment });
    } catch (err) {
        console.error('Admin enroll error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/enrollments/:id  (admin)
enrollmentRouter.patch('/:id', auth.protect, auth.adminOnly, async (req, res) => {
    const { groupId, projectStatus } = req.body;

    try {
        const enrollment = await Enrollment.findById(req.params.id);
        if (!enrollment) return res.status(404).json({ message: 'Enrollment not found' });

        const update = {};

        if (groupId) {
            const group = await Group.findOne({ _id: groupId, course: enrollment.course });
            if (!group) return res.status(400).json({ message: 'Group does not belong to this course' });
            update.group = group._id;
        }

        if (projectStatus) {
            update.projectStatus = projectStatus;
            if (projectStatus === 'completed') update.projectCompletedAt = new Date();
        }

        const updated = await Enrollment.findByIdAndUpdate(req.params.id, update, { new: true })
            .populate('user', 'username email role')
            .populate('course', 'courseCode name')
            .populate('group', 'name slug');

        res.json({ enrollment: updated });
    } catch (err) {
        console.error('Update enrollment error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/enrollments/:id  (admin)
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