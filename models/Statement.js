import mongoose from 'mongoose';

const statementSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            default: null,
        },
        group: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Group',
            default: null,
        },
        verb: {
            uri: { type: String, required: true },
            display: { type: String, required: true },
        },
        stage: {
            type: String,
            enum: ['Planning', 'Exploration', 'Construction', 'Testing', 'Reflection', null],
            default: null,
        },
        problemStep: {
            type: String,
            trim: true,
            default: null,
        },
        // scenario is intentionally excluded from collection but kept here for easy re-enable
        // scenario: { type: String, enum: ['Planner', 'Tinkerer', 'LateTester', null], default: null },
        description: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        rawStatement: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        lrsStatementId: {
            type: String,
            default: null,
        },
        lrsSynced: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

statementSchema.index({ user: 1, createdAt: -1 });
statementSchema.index({ group: 1, createdAt: -1 });
statementSchema.index({ course: 1, createdAt: -1 });
statementSchema.index({ stage: 1, createdAt: -1 });
statementSchema.index({ problemStep: 1 });

const Statement = mongoose.model('Statement', statementSchema);
export default Statement;