import mongoose from 'mongoose';

// One document per user per course.
// Group is selected by the student when they first use a course
// or can be updated by an admin later.


const enrollmentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },


        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true,
        },

        group: {
            type: String,
            required: true,
            enum: ['group-a', 'group-b', 'group-c'],
        },

        projectStatus: {
            type: String,
            enum: ['not-started', 'in-progress', 'completed'],
            default: 'not-started',
        },

        projectStartedAt: {
            type: Date,
            default: null,
        },

        projectCompletedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });

const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
export default Enrollment;