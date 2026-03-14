import Enrollment from '../models/Enrollment.js';
import Course from '../models/Course.js';
import Group from '../models/Group.js';
import User from '../models/User.js';

const populateEnrollment = (query) =>
    query
        .populate('course', 'courseCode name uri project')
        .populate('group', 'name slug');

// GET /api/enrollments/my
export const getMyEnrollments = async (req, res) => {
    try {
        const enrollments = await populateEnrollment(
            Enrollment.find({ user: req.user._id })
        ).lean();
        res.json({ enrollments });
    } catch (err) {
        console.error('Get my enrollments error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/enrollments/my/:courseCode
export const getMyEnrollmentByCourse = async (req, res) => {
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
};

// POST /api/enrollments/join
// Body: { courseCode, groupId }  — groupId is the Group ObjectId
export const joinGroup = async (req, res) => {
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
};

// GET /api/enrollments (admin)
export const getAllEnrollments = async (req, res) => {
    try {
        const filter = {};

        if (req.query.course) {
            const course = await Course.findOne({ courseCode: req.query.course.toUpperCase() });
            if (course) filter.course = course._id;
        }
        if (req.query.group) filter.group = req.query.group;

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
};

// POST /api/enrollments (admin)
// Body: { email, courseCode, groupId }
export const enrollStudent = async (req, res) => {
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
};

// POST /api/enrollments/bulk (admin)
// Flexible CSV — any combo of: username, email, password, comp3609, comp3610
// Missing fields are derived: email from username (@my.uwi.edu), username from email, password defaults
export const bulkEnroll = async (req, res) => {
    const { csv, onDuplicate = 'skip' } = req.body;

    if (!csv) {
        return res.status(400).json({ message: 'csv is required' });
    }

    try {
        const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) return res.status(400).json({ message: 'CSV must have a header row and at least one data row' });

        // Normalise headers to lowercase, strip quotes
        const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
        const dataLines = lines.slice(1);

        // Detect which course columns are present
        const has3609 = headers.includes('comp3609');
        const has3610 = headers.includes('comp3610');

        // Pre-fetch courses once
        const [course3609, course3610] = await Promise.all([
            has3609 ? Course.findOne({ courseCode: 'COMP3609' }) : null,
            has3610 ? Course.findOne({ courseCode: 'COMP3610' }) : null,
        ]);

        const results = { enrolled: [], skipped: [], created: [], failed: [] };

        for (const line of dataLines) {
            const vals = line.split(',').map((v) => v.replace(/^"|"$/g, '').trim());
            const row = Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));

            // Derive missing identity fields
            let { username, email, password } = row;

            if (!email && username) email = `${username}@my.uwi.edu`;
            if (!username && email) username = email.split('@')[0];
            if (!email && !username) {
                results.failed.push({ row: line, reason: 'No email or username provided' });
                continue;
            }
            if (!password) password = 'studentUWi@1234';

            email = email.toLowerCase();

            try {
                let user = await User.findOne({ $or: [{ email }, { username }] });

                if (!user) {
                    user = await User.create({ username, email, password, role: 'student' });
                    results.created.push(email);
                }

                // Enroll in comp3609 if column present and value is not empty
                if (has3609 && row.comp3609 && course3609) {
                    const slug3609 = row.comp3609.toLowerCase().replace(/\s+/g, '-');
                    // Create group if it doesn't exist yet
                    let group3609 = await Group.findOne({ course: course3609._id, slug: slug3609 });
                    if (!group3609) group3609 = await Group.create({ name: row.comp3609.trim(), slug: slug3609, course: course3609._id });

                    const existing3609 = await Enrollment.findOne({ user: user._id, course: course3609._id });
                    if (existing3609 && onDuplicate === 'skip') {
                        results.skipped.push(`${email} (COMP3609)`);
                    } else {
                        await Enrollment.findOneAndUpdate(
                            { user: user._id, course: course3609._id },
                            { group: group3609._id, projectStatus: 'in-progress', projectStartedAt: new Date() },
                            { upsert: true, new: true }
                        );
                        results.enrolled.push(`${email} (COMP3609)`);
                    }
                }

                // Enroll in comp3610 if column present and value is not empty
                if (has3610 && row.comp3610 && course3610) {
                    const slug3610 = row.comp3610.toLowerCase().replace(/\s+/g, '-');
                    // Create group if it doesn't exist yet
                    let group3610 = await Group.findOne({ course: course3610._id, slug: slug3610 });
                    if (!group3610) group3610 = await Group.create({ name: row.comp3610.trim(), slug: slug3610, course: course3610._id });

                    const existing3610 = await Enrollment.findOne({ user: user._id, course: course3610._id });
                    if (existing3610 && onDuplicate === 'skip') {
                        results.skipped.push(`${email} (COMP3610)`);
                    } else {
                        await Enrollment.findOneAndUpdate(
                            { user: user._id, course: course3610._id },
                            { group: group3610._id, projectStatus: 'in-progress', projectStartedAt: new Date() },
                            { upsert: true, new: true }
                        );
                        results.enrolled.push(`${email} (COMP3610)`);
                    }
                }

            } catch (err) {
                results.failed.push({ email: email || username, reason: err.message });
            }
        }

        res.status(201).json({ results });
    } catch (err) {
        console.error('Bulk enroll error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// PATCH /api/enrollments/:id (admin)
export const updateEnrollment = async (req, res) => {
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
};

// DELETE /api/enrollments/:id (admin)
export const deleteEnrollment = async (req, res) => {
    try {
        const enrollment = await Enrollment.findByIdAndDelete(req.params.id);
        if (!enrollment) return res.status(404).json({ message: 'Enrollment not found' });
        res.json({ message: 'Enrollment removed' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};