const adminModel = require('../models/admin_model');
const brcypt = require('bcrypt');
const userModel = require('../models/user_model');
const projectModel = require('../models/project_model');

async function CreateAdmin(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required'
        });
    }

    try {
        const existingAdmin = await adminModel.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: 'Admin with this email already exists'
            });
        }

        const salt = await brcypt.genSalt(10);
        const hash = await brcypt.hash(password, salt);
        const admin = await adminModel.create({ email, password: hash });

        return res.status(201).json({
            success: true,
            message: 'Admin created successfully',
            data: {
                _id: admin._id,
                email: admin.email,
                createdAt: admin.createdAt
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to create admin',
            error: err.message
        });
    }
}

async function getAllAdmins(req, res) {
    try {
        const admins = await adminModel
            .find()
            .select('-password')
            .sort({ _id: -1 });

        return res.status(200).json({
            success: true,
            message: 'Admins fetched successfully',
            data: admins
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch admins',
            error: error.message
        });
    }
}

async function getAdminDashboardSummary(req, res) {
    try {
        const [studentCount, teacherCount, admins, projects] = await Promise.all([
            userModel.countDocuments({ role: 'student' }),
            userModel.countDocuments({ role: 'teacher' }),
            adminModel.find().select('-password').sort({ createdAt: -1 }),
            projectModel
                .find()
                .populate('students', 'name email')
                .sort({ createdAt: -1 })
        ]);

        const committeeQueue = [];
        let committeeApproved = 0;

        projects.forEach((project) => {
            const teacherStatus = project?.proposalStatus || 'pending';
            const committeeStatus = project?.committeeStatus || 'not_started';

            if (committeeStatus === 'approved') {
                committeeApproved += 1;
            }

            if (
                teacherStatus === 'accepted' &&
                (committeeStatus === 'pending' || committeeStatus === 'not_started')
            ) {
                committeeQueue.push(project);
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Admin dashboard summary fetched successfully',
            data: {
                metrics: {
                    studentCount,
                    teacherCount,
                    committeeApproved,
                    committeePending: committeeQueue.length,
                    totalProjects: projects.length
                },
                committeeQueue,
                admins,
                currentAdmin: {
                    id: req?.auth?.accountId || '',
                    email: req?.auth?.email || ''
                }
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch admin dashboard summary',
            error: error.message
        });
    }
}

module.exports = { CreateAdmin, getAllAdmins, getAdminDashboardSummary };
