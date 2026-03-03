const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
    {
        originalName: { type: String, trim: true },
        fileName: { type: String, trim: true },
        filePath: { type: String, trim: true },
        url: { type: String, trim: true },
        downloadUrl: { type: String, trim: true },
        thumbnailUrl: { type: String, trim: true },
        fileId: { type: String, trim: true },
        mimeType: { type: String, trim: true },
        size: { type: Number }
    },
    { _id: false }
);

const taskSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium'
        },
        status: {
            type: String,
            enum: ['pending', 'in_progress', 'completed'],
            default: 'pending'
        },
        dueDate: { type: Date },
        completedAt: { type: Date }
    },
    { timestamps: true }
);

const activitySchema = new mongoose.Schema(
    {
        type: { type: String, trim: true },
        message: { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now }
    },
    { _id: false }
);

const messageSchema = new mongoose.Schema(
    {
        senderRole: {
            type: String,
            enum: ['student', 'teacher'],
            required: true
        },
        text: { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now }
    },
    { _id: false }
);

const resourceSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        category: { type: String, trim: true, default: 'general' },
        url: { type: String, required: true, trim: true }
    },
    { timestamps: true }
);

const submissionSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        documents: [documentSchema],
        submittedAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

const studentWorkspaceSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user',
            required: true,
            unique: true
        },
        tasks: [taskSchema],
        activities: [activitySchema],
        resources: [resourceSchema],
        submissions: [submissionSchema],
        messages: [messageSchema]
    },
    { timestamps: true }
);

const StudentWorkspaceModel = mongoose.model('student_workspace', studentWorkspaceSchema);

module.exports = StudentWorkspaceModel;
