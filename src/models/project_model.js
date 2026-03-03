const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    title:{
        type:String,
        required:true   
    },

    description:{
        type:String,
        required:true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    proposalStatus: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },
    reviewedAt: {
        type: Date
    },
    reviewNote: {
        type: String,
        trim: true
    },
    committeeStatus: {
        type: String,
        enum: ['not_started', 'pending', 'approved', 'rejected'],
        default: 'not_started'
    },
    committeeReviewedAt: {
        type: Date
    },
    committeeNote: {
        type: String,
        trim: true
    },
    Domain: {
        type: String,
        required: true
    },
    supervisor: {
        type: String,
        required: true
    },
    supervisorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    students: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    documents: [
        {
            originalName: {
                type: String,
                trim: true
            },
            fileName: {
                type: String,
                trim: true
            },
            filePath: {
                type: String,
                trim: true
            },
            url: {
                type: String,
                trim: true
            },
            downloadUrl: {
                type: String,
                trim: true
            },
            thumbnailUrl: {
                type: String,
                trim: true
            },
            fileId: {
                type: String,
                trim: true
            },
            mimeType: {
                type: String,
                trim: true
            },
            size: {
                type: Number
            }
        }
    ]
},
{
    timestamps: true
});
const projectModel = mongoose.model('project', projectSchema);

module.exports = projectModel;
