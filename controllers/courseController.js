import Course from '../models/Course.js';
import Group from '../models/Group.js';

// GET /api/courses
export const getCourses = async (req, res) => {
    try {
        const courses = await Course.find().sort({ courseCode: 1 });
        res.json({ courses });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/courses/:courseCode
export const getCourse = async (req, res) => {
    try {
        const course = await Course.findOne({
            courseCode: req.params.courseCode.toUpperCase(),
        });
        if (!course) return res.status(404).json({ message: 'Course not found' });
        res.json({ course });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/courses/:courseCode/groups
export const getGroups = async (req, res) => {
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
};

// POST /api/courses/:courseCode/groups
// Any authenticated student can create a group for a course
export const createGroup = async (req, res) => {
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
};

// POST /api/courses/:courseCode/groups/bulk (admin)
// Body: { csv } — CSV text with a header row of "name", one group per line
export const bulkCreateGroups = async (req, res) => {
    try {
        const { csv } = req.body;
        if (!csv) return res.status(400).json({ message: 'CSV content is required' });

        const course = await Course.findOne({
            courseCode: req.params.courseCode.toUpperCase(),
        });
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
        // Skip header row if present
        const dataLines = lines[0]?.toLowerCase() === 'name' ? lines.slice(1) : lines;

        const results = { created: [], skipped: [], failed: [] };

        for (const line of dataLines) {
            const name = line.replace(/^"|"$/g, '').trim();
            if (!name) continue;

            const slug = name.toLowerCase().replace(/\s+/g, '-');
            try {
                const exists = await Group.findOne({ course: course._id, slug });
                if (exists) {
                    results.skipped.push(name);
                    continue;
                }
                await Group.create({ name, slug, course: course._id });
                results.created.push(name);
            } catch {
                results.failed.push(name);
            }
        }

        const groups = await Group.find({ course: course._id }).sort({ name: 1 });
        res.status(201).json({ results, groups });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/courses/:courseCode/groups/:groupId (admin)
export const deleteGroup = async (req, res) => {
    try {
        const group = await Group.findByIdAndDelete(req.params.groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        res.json({ message: 'Group removed' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
