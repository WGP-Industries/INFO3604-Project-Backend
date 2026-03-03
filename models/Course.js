import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema(
    {
        courseCode: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        uri: {
            type: String,
            required: true,
        },
        project: {
            name: { type: String, required: true, trim: true },
            description: { type: String, trim: true },
            uri: { type: String, trim: true },
        },
    },
    { timestamps: true }
);

const Course = mongoose.model('Course', courseSchema);
export default Course;