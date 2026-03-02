import mongoose from 'mongoose';

// Local copy of every xAPI statement sent to the LRS.
// Full rawStatement JSON kept so we can query without hitting LRS.
// lrsStatementId links back to Veracity.
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
            type: String,
            enum: ['group-a', 'group-b', 'group-c', null],
            default: null,
        },

        verb: {
            uri: { type: String, required: true },
            display: { type: String, required: true },
        },

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

const Statement = mongoose.model('Statement', statementSchema);
export default Statement;