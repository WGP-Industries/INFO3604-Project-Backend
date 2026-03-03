import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        // Human-readable slug, auto-generated from name e.g. "Group A" → "group-a"
        slug: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true,
        },
    },
    { timestamps: true }
);

// Slug must be unique within a course
groupSchema.index({ course: 1, slug: 1 }, { unique: true });

const Group = mongoose.model('Group', groupSchema);
export default Group;