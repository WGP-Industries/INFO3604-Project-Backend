import fetch from 'node-fetch';
import { lrsHeaders } from '../config/lrs.js';
import Statement from '../models/Statement.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import User from '../models/User.js';

const BASE_URI = 'https://student-analytics-app.vercel.app/xapi';

const populateStatement = (query) =>
    query
        .populate('user', 'username email')
        .populate('course', 'courseCode name')
        .populate('group', 'name slug');

// POST /api/xapi
export const submitStatement = async (req, res) => {
    const { statement, additionalData } = req.body;

    if (!statement) {
        return res.status(400).json({ message: 'xAPI statement is required' });
    }

    // ── Resolve course ─────────────────────────────────────────────────────────
    // Primary: courseCode from additionalData (direct, reliable).
    // Fallback: parse from verb URI for backwards compatibility with any older
    //           clients that may not send additionalData.courseCode yet.
    let course = null;
    const verbUri = statement.verb?.id || '';

    const rawCourseCode = additionalData?.courseCode?.toUpperCase?.()
        ?? (() => {
            // fallback: .../xapi/verbs/{courseCode}/{verbName}
            const afterVerbs = verbUri.split('/xapi/verbs/')[1];
            return afterVerbs?.split('/')[0]?.toUpperCase() ?? null;
        })();

    if (rawCourseCode) course = await Course.findOne({ courseCode: rawCourseCode });

    // ── Resolve group from the server-side enrollment ──────────────────────────
    // We always re-resolve from the DB rather than trusting the client payload,
    // so the stored groupId is authoritative even if the client sends stale data.
    let groupId = null;
    if (course) {
        const enrollment = await Enrollment.findOne({
            user: req.user._id,
            course: course._id,
        });
        groupId = enrollment?.group ?? null;
    }

    // ── Extract metadata ───────────────────────────────────────────────────────
    const extensions = statement.context?.extensions ?? {};
    const stage = additionalData?.stage
        ?? extensions[`${BASE_URI}/extensions/pedagogical-stage`]
        ?? null;
    const problemStep = additionalData?.problemStep
        ?? extensions[`${BASE_URI}/extensions/problem-step`]
        ?? null;

    const localStatement = await Statement.create({
        user:        req.user._id,
        course:      course?._id ?? null,
        group:       groupId,
        stage,
        problemStep,
        verb: {
            uri:     verbUri,
            display: statement.verb?.display?.['en-US'] || '',
        },
        description:  additionalData?.description || '',
        rawStatement: statement,
        lrsSynced:    false,
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
        await Statement.findByIdAndUpdate(localStatement._id, { lrsSynced: true, lrsStatementId });

        res.json({ success: true, localId: localStatement._id, lrsStatementId });
    } catch (err) {
        console.error('LRS forward error:', err.message);
        res.json({
            success: false,
            localId: localStatement._id,
            message: 'Statement saved locally but could not reach LRS',
        });
    }
};

// GET /api/xapi/statements
// Scoped to the current user's own statements
export const getMyStatements = async (req, res) => {
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

        const statements = await populateStatement(
            Statement.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(limit)
        ).lean();

        res.json({ statements, total: statements.length });
    } catch (err) {
        console.error('Fetch statements error:', err);
        res.status(500).json({ message: 'Failed to fetch statements' });
    }
};

// GET /api/xapi/admin/statements (admin)
export const getAdminStatements = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const filter = {};

        if (req.query.course) {
            const course = await Course.findOne({ courseCode: req.query.course.toUpperCase() });
            if (course) filter.course = course._id;
        }
        if (req.query.group) filter.group = req.query.group;
        if (req.query.stage) filter.stage = req.query.stage;
        if (req.query.problemStep) filter.problemStep = req.query.problemStep;
        if (req.query.userId) filter.user = req.query.userId;
        if (req.query.verb) {
            filter['verb.display'] = { $regex: req.query.verb, $options: 'i' };
        }

        const statements = await populateStatement(
            Statement.find(filter).sort({ createdAt: -1 }).limit(limit)
        ).lean();

        res.json({ statements, total: statements.length });
    } catch (err) {
        console.error('Admin fetch statements error:', err);
        res.status(500).json({ message: 'Failed to fetch statements' });
    }
};

// GET /api/xapi/admin/stats (admin)
export const getAdminStats = async (req, res) => {
    try {
        const [
            totalUsers,
            totalStatements,
            totalEnrollments,
            lrsSynced,
            statementsByCourse,
            statementsByGroup,
            statementsByVerb,
            statementsByStage,
            statementsByStep,
            recentStatements,
        ] = await Promise.all([
            User.countDocuments({}),
            Statement.countDocuments({}),
            Enrollment.countDocuments({}),
            Statement.countDocuments({ lrsSynced: true }),

            Statement.aggregate([
                { $match: { course: { $ne: null } } },
                { $group: { _id: '$course', count: { $sum: 1 } } },
                { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'course' } },
                { $unwind: '$course' },
                { $project: { courseCode: '$course.courseCode', name: '$course.name', count: 1 } },
            ]),

            Statement.aggregate([
                { $match: { group: { $ne: null } } },
                { $group: { _id: '$group', count: { $sum: 1 } } },
                { $lookup: { from: 'groups', localField: '_id', foreignField: '_id', as: 'group' } },
                { $unwind: '$group' },
                { $project: { name: '$group.name', slug: '$group.slug', count: 1 } },
                { $sort: { name: 1 } },
            ]),

            Statement.aggregate([
                { $group: { _id: '$verb.display', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]),

            Statement.aggregate([
                { $match: { stage: { $ne: null } } },
                { $group: { _id: '$stage', count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]),

            Statement.aggregate([
                { $match: { problemStep: { $ne: null } } },
                { $group: { _id: '$problemStep', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),

            Statement.aggregate([
                { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]),
        ]);

        res.json({
            totals: { users: totalUsers, statements: totalStatements, enrollments: totalEnrollments, lrsSynced },
            statementsByCourse,
            statementsByGroup,
            statementsByVerb,
            statementsByStage,
            statementsByStep,
            recentStatements,
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ message: 'Failed to fetch stats' });
    }
};
