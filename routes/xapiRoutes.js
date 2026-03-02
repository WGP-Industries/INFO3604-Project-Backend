import { Router } from 'express';
import fetch from 'node-fetch';
import auth from '../middleware/auth.js';
import { lrsHeaders } from '../config/lrs.js';
import Statement from '../models/Statement.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import User from '../models/User.js';

const xapiRouter = Router();

// POST /api/xapi
xapiRouter.post('/', auth.protect, async (req, res) => {
    const { statement, additionalData } = req.body;

    if (!statement) {
        return res.status(400).json({ message: 'xAPI statement is required' });
    }

    // Resolve course from the verb URI
    // e.g. "https://example.edu/comp3609/xapi/verbs/implemented" resolves to COMP3609
    let course = null;
    const verbUri = statement.verb?.id || '';
    if (verbUri.includes('example.edu')) {
        const courseCode = verbUri.split('example.edu/')[1]?.split('/')[0]?.toUpperCase();
        if (courseCode) course = await Course.findOne({ courseCode });
    }

    // Resolve group from the user's enrollment in this course
    let group = null;
    if (course) {
        const enrollment = await Enrollment.findOne({
            user: req.user._id,
            course: course._id,
        });
        group = enrollment?.group ?? null;
    }

    const localStatement = await Statement.create({
        user: req.user._id,
        course: course?._id ?? null,
        group,
        verb: {
            uri: verbUri,
            display: statement.verb?.display?.['en-US'] || '',
        },
        description: additionalData?.description || '',
        rawStatement: statement,
        lrsSynced: false,
    });

    // Forward to LRS
    try {
        const lrsRes = await fetch(process.env.LRS_ENDPOINT, {
            method: 'POST',
            headers: lrsHeaders(),
            body: JSON.stringify(statement),
        });

        const text = await lrsRes.text();
        let lrsData;
        try { lrsData = JSON.parse(text); } catch { lrsData = text; }

        if (!lrsRes.ok) {
            console.error('LRS rejected statement:', text);
            return res.status(lrsRes.status).json({
                message: 'Statement saved locally but LRS rejected it',
                localId: localStatement._id,
                error: text,
            });
        }

        const lrsStatementId = Array.isArray(lrsData) ? lrsData[0] : lrsData;
        await Statement.findByIdAndUpdate(localStatement._id, {
            lrsSynced: true,
            lrsStatementId,
        });

        res.json({ success: true, localId: localStatement._id, lrsStatementId });
    } catch (err) {
        console.error('LRS forward error:', err.message);
        res.json({
            success: false,
            localId: localStatement._id,
            message: 'Statement saved locally but could not reach LRS',
        });
    }
});

// GET /api/xapi/statements
// Student scoped: returns statements where the course and group match
// one of the user's active enrollments.
xapiRouter.get('/statements', auth.protect, async (req, res) => {
    try {
        if (req.query.source === 'lrs') {
            const params = new URLSearchParams(req.query);
            params.delete('source');
            const url = params.toString()
                ? `${process.env.LRS_ENDPOINT}?${params}`
                : process.env.LRS_ENDPOINT;
            const lrsRes = await fetch(url, { method: 'GET', headers: lrsHeaders() });
            if (!lrsRes.ok) throw new Error(`LRS error: ${lrsRes.status}`);
            return res.json(await lrsRes.json());
        }

        const limit = Math.min(parseInt(req.query.limit) || 50, 200);

        const enrollments = await Enrollment.find({ user: req.user._id });

        const groupCourseFilters = enrollments.map((e) => ({
            course: e.course,
            group: e.group,
        }));

        const query = groupCourseFilters.length > 0
            ? { $or: groupCourseFilters }
            : { user: req.user._id };

        const statements = await Statement.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('user', 'username email')
            .populate('course', 'courseCode name')
            .lean();

        res.json({ statements, total: statements.length });
    } catch (err) {
        console.error('Fetch statements error:', err);
        res.status(500).json({ message: 'Failed to fetch statements' });
    }
});

// GET /api/xapi/admin/statements (admin)
// Unscoped. Returns all statements across all users and courses.
// Supports optional filters: ?course=COMP3609 &group=group-a &verb=Implemented &userId=xxx
xapiRouter.get('/admin/statements', auth.protect, auth.adminOnly, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const filter = {};

        if (req.query.course) {
            const course = await Course.findOne({ courseCode: req.query.course.toUpperCase() });
            if (course) filter.course = course._id;
        }
        if (req.query.group) filter.group = req.query.group;
        if (req.query.userId) filter.user = req.query.userId;
        if (req.query.verb) {
            filter['verb.display'] = { $regex: req.query.verb, $options: 'i' };
        }

        const statements = await Statement.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('user', 'username email')
            .populate('course', 'courseCode name')
            .lean();

        res.json({ statements, total: statements.length });
    } catch (err) {
        console.error('Admin fetch statements error:', err);
        res.status(500).json({ message: 'Failed to fetch statements' });
    }
});

// GET /api/xapi/admin/stats (admin)
// Returns aggregated counts and breakdowns for the admin dashboard.
xapiRouter.get('/admin/stats', auth.protect, auth.adminOnly, async (req, res) => {
    try {
        const [
            totalUsers,
            totalStatements,
            totalEnrollments,
            lrsSynced,
            statementsByCourse,
            statementsByGroup,
            statementsByVerb,
            recentStatements,
        ] = await Promise.all([
            User.countDocuments({}),
            Statement.countDocuments({}),
            Enrollment.countDocuments({}),
            Statement.countDocuments({ lrsSynced: true }),

            // Statements grouped by course
            Statement.aggregate([
                { $match: { course: { $ne: null } } },
                { $group: { _id: '$course', count: { $sum: 1 } } },
                { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'course' } },
                { $unwind: '$course' },
                { $project: { courseCode: '$course.courseCode', name: '$course.name', count: 1 } },
            ]),

            // Statements grouped by group
            Statement.aggregate([
                { $match: { group: { $ne: null } } },
                { $group: { _id: '$group', count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]),

            // Top 10 verbs by usage
            Statement.aggregate([
                { $group: { _id: '$verb.display', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]),

            // Daily statement counts for the past 7 days
            Statement.aggregate([
                {
                    $match: {
                        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                    },
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
        ]);

        res.json({
            totals: {
                users: totalUsers,
                statements: totalStatements,
                enrollments: totalEnrollments,
                lrsSynced,
            },
            statementsByCourse,
            statementsByGroup,
            statementsByVerb,
            recentStatements,
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ message: 'Failed to fetch stats' });
    }
});

export default xapiRouter;