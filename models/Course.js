import mongoose from 'mongoose';


const courseSchema = new mongoose.Schema(
    {
        courseCode: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
            // e.g. "COMP3609"
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
            // xAPI activity ID base, e.g. "https://example.edu/comp3609"
        },
        project: {
            name: { type: String, required: true, trim: true },
            description: { type: String, trim: true },
        },
    },
    { timestamps: true }
);

const Course = mongoose.model('Course', courseSchema);
export default Course;