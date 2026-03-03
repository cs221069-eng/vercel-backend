const userModel = require('../models/user_model');
const projectModel = require('../models/project_model');
const studentWorkspaceModel = require('../models/student_workspace_model');
const { uploadFileToImageKit } = require('../utils/services');
const bcrypt = require('bcrypt');

const PROPOSAL_STATUSES = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected'
};
const COMMITTEE_STATUSES = {
    NOT_STARTED: 'not_started',
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
};
const SUPERVISOR_ACCEPT_LIMIT = 4;

function normalizeProjectStatus(projectDoc) {
    if (!projectDoc) return null;

    const project = typeof projectDoc.toObject === 'function'
        ? projectDoc.toObject()
        : { ...projectDoc };

    project.proposalStatus = project.proposalStatus || PROPOSAL_STATUSES.PENDING;

    if (!project.committeeStatus) {
        project.committeeStatus =
            project.proposalStatus === PROPOSAL_STATUSES.ACCEPTED
                ? COMMITTEE_STATUSES.PENDING
                : COMMITTEE_STATUSES.NOT_STARTED;
    }

    return project;
}

function getDefaultResources() {
    return [
        {
            title: 'FYP Proposal Template',
            category: 'template',
            url: 'https://example.com/fyp-proposal-template'
        },
        {
            title: 'Final Report Guidelines',
            category: 'guideline',
            url: 'https://example.com/final-report-guidelines'
        }
    ];
}

async function getOrCreateStudentWorkspace(studentId) {
    let workspace = await studentWorkspaceModel.findOne({ student: studentId });
    if (!workspace) {
        workspace = await studentWorkspaceModel.create({
            student: studentId,
            tasks: [],
            activities: [
                {
                    type: 'system',
                    message: 'Student workspace initialized'
                }
            ],
            resources: getDefaultResources(),
            submissions: [],
            messages: []
        });
    } else if (!workspace.resources || workspace.resources.length === 0) {
        workspace.resources = getDefaultResources();
        await workspace.save();
    }

    return workspace;
}

function getTimelineFromProject(project) {
    if (!project) return [];

    const timeline = [];
    timeline.push({
        key: 'proposal_submission',
        label: 'Proposal Submitted',
        status: 'completed',
        date: project.createdAt || null,
        description: 'Initial proposal submitted by student.'
    });

    const proposalStatus = project.proposalStatus || PROPOSAL_STATUSES.PENDING;
    if (proposalStatus === PROPOSAL_STATUSES.PENDING) {
        timeline.push({
            key: 'teacher_review',
            label: 'Teacher Review',
            status: 'in_progress',
            date: null,
            description: 'Waiting for teacher decision.'
        });
    } else {
        timeline.push({
            key: 'teacher_review',
            label: 'Teacher Review',
            status: proposalStatus === PROPOSAL_STATUSES.ACCEPTED ? 'completed' : 'rejected',
            date: project.reviewedAt || null,
            description:
                proposalStatus === PROPOSAL_STATUSES.ACCEPTED
                    ? 'Teacher accepted the proposal.'
                    : 'Teacher rejected the proposal.'
        });
    }

    const committeeStatus = project.committeeStatus || COMMITTEE_STATUSES.NOT_STARTED;
    if (proposalStatus !== PROPOSAL_STATUSES.ACCEPTED) {
        timeline.push({
            key: 'committee_review',
            label: 'Committee Review',
            status: 'blocked',
            date: null,
            description: 'Starts after teacher acceptance.'
        });
    } else {
        timeline.push({
            key: 'committee_review',
            label: 'Committee Review',
            status:
                committeeStatus === COMMITTEE_STATUSES.APPROVED
                    ? 'completed'
                    : committeeStatus === COMMITTEE_STATUSES.REJECTED
                        ? 'rejected'
                        : 'in_progress',
            date: project.committeeReviewedAt || null,
            description:
                committeeStatus === COMMITTEE_STATUSES.APPROVED
                    ? 'Committee approved the proposal.'
                    : committeeStatus === COMMITTEE_STATUSES.REJECTED
                        ? 'Committee rejected the proposal.'
                        : 'Waiting for committee decision.'
        });
    }

    return timeline;
}

async function createUser(req, res) {
    const { name, email, password, role, department } = req.body;

    if (!name || !email || !password || !role || !department) {
        return res.status(400).json({
            success: false,
            message: 'All fields are required'
        });
    }

    try {
        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already in use'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const newUser = await userModel.create({
            name,
            email,
            password: hash,
            role,
            department
        });

        return res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: newUser
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to create user',
            error: error.message
        });
    }
};

async function getAllUser(req, res) {
    try {
        const parsedPage = Number.parseInt(req.query.page, 10);
        const parsedLimit = Number.parseInt(req.query.limit, 10);
        const shouldPaginate =
            req.query.paginate === 'true' ||
            Number.isInteger(parsedPage) ||
            Number.isInteger(parsedLimit);

        if (!shouldPaginate) {
            const users = await userModel.find().sort({ createdAt: -1 });

            return res.status(200).json({
                success: true,
                message: 'Users fetched successfully',
                data: users
            });
        }

        const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
        const limit = Number.isInteger(parsedLimit) && parsedLimit > 0
            ? Math.min(parsedLimit, 100)
            : 20;
        const totalUsers = await userModel.countDocuments();
        const totalPages = Math.max(Math.ceil(totalUsers / limit), 1);
        const currentPage = Math.min(page, totalPages);
        const skip = (currentPage - 1) * limit;
        const users = await userModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit);

        return res.status(200).json({
            success: true,
            message: 'Users fetched successfully',
            data: users,
            pagination: {
                currentPage,
                limit,
                totalUsers,
                totalPages
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: error.message
        });
    }
}

async function EidtUser(req, res) {
    const { id } = req.params;
    const { name, email, password, role, department, status } = req.body;

    if (!name || !email || !role || !department) {
        return res.status(400).json({
            success: false,
            message: 'Name, email, role and department are required'
        });
    }

    try {
        const updateData = { name, email, role, department };

        if (typeof status === 'string' && status.trim()) {
            updateData.status = status;
        }

        if (typeof password === 'string' && password.trim()) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        const updatedUser = await userModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'User updated successfully',
            user: updatedUser
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to update user',
            error: error.message
        });
    }
}

async function DeleteUser(req, res) {
    const { id } = req.params;

    try {
        const deletedUser = await userModel.findByIdAndDelete(id);

        if (!deletedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to delete user',
            error: error.message
        });
    }
}   

async function projectDetail(req, res) {
    const { id } = req.params;
    const { title, description, Domain, supervisor } = req.body;

    if (!id || !title || !description || !Domain || !supervisor) {
        return res.status(400).json({
            success: false,
            message: 'Student id, title, description, domain and supervisor are required'
        });
    }

    try {
        const student = await userModel.findOne({ _id: id, role: 'student' }).select('_id name');
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        const existingActiveRequest = await projectModel
            .findOne({
                students: id,
                $or: [
                    { proposalStatus: { $in: [PROPOSAL_STATUSES.PENDING, PROPOSAL_STATUSES.ACCEPTED] } },
                    { proposalStatus: { $exists: false } }
                ]
            })
            .sort({ createdAt: -1 })
            .select('supervisor proposalStatus createdAt');

        if (existingActiveRequest) {
            return res.status(400).json({
                success: false,
                message: `You already have an active request with ${existingActiveRequest.supervisor}. Wait for rejection before sending to another teacher.`,
                data: existingActiveRequest
            });
        }

        // Prefer supervisor as teacher id from client; keep fallback for legacy name payload.
        let supervisorId = null;
        let supervisorName = "";

        const supervisorById = await userModel.findOne({
            _id: supervisor,
            role: 'teacher'
        }).select('_id name');

        if (supervisorById) {
            supervisorId = supervisorById._id;
            supervisorName = supervisorById.name;
        } else {
            const supervisorByName = await userModel.findOne({
                name: supervisor,
                role: 'teacher'
            }).select('_id name');

            supervisorId = supervisorByName?._id || null;
            supervisorName = supervisorByName?.name || supervisor;
        }

        const uploadedDocuments = [];
        for (const file of req.files || []) {
            console.log('Processing file:', file.originalname);
            const uploadedDocument = await uploadFileToImageKit(file, `/fyp/projects/${id}`);
            uploadedDocuments.push(uploadedDocument);
        }

        const project = await projectModel.create({
            title,
            description,
            Domain,
            supervisor: supervisorName,
            supervisorId,
            students: id,
            proposalStatus: PROPOSAL_STATUSES.PENDING,
            committeeStatus: COMMITTEE_STATUSES.NOT_STARTED,
            documents: uploadedDocuments
        });

        return res.status(201).json({
            success: true,
            message: 'Project created successfully',
            project
        });
    } catch (error) {
        console.error('Project create/upload error:', error);
        return res.status(500).json({
            success: false,
            message: `Failed to create project: ${error.message}`,
            error: error.message
        });
    }

    
}

async function reviewProjectProposal(req, res) {
    const { projectId, teacherId } = req.params;
    const { action, reviewNote } = req.body;

    if (!projectId || !teacherId || !action) {
        return res.status(400).json({
            success: false,
            message: 'Project id, teacher id and action are required'
        });
    }

    if (!['accept', 'reject'].includes(action)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid action. Use "accept" or "reject"'
        });
    }

    try {
        const teacher = await userModel
            .findOne({ _id: teacherId, role: 'teacher' })
            .select('_id name');

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        const project = await projectModel.findById(projectId);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        const belongsToTeacher =
            (project.supervisorId && String(project.supervisorId) === String(teacher._id)) ||
            project.supervisor === teacher.name;

        if (!belongsToTeacher) {
            return res.status(403).json({
                success: false,
                message: 'You are not allowed to review this proposal'
            });
        }

        const currentStatus = project.proposalStatus || PROPOSAL_STATUSES.PENDING;
        if (currentStatus !== PROPOSAL_STATUSES.PENDING) {
            return res.status(400).json({
                success: false,
                message: `Proposal already ${currentStatus}`
            });
        }

        if (action === 'accept') {
            const acceptedCount = await projectModel.countDocuments({
                proposalStatus: PROPOSAL_STATUSES.ACCEPTED,
                _id: { $ne: project._id },
                $or: [
                    { supervisorId: teacher._id },
                    { supervisor: teacher.name }
                ]
            });

            if (acceptedCount >= SUPERVISOR_ACCEPT_LIMIT) {
                return res.status(400).json({
                    success: false,
                    message: 'Supervisor is not available. Maximum accepted proposal limit reached.'
                });
            }
        }

        project.proposalStatus =
            action === 'accept' ? PROPOSAL_STATUSES.ACCEPTED : PROPOSAL_STATUSES.REJECTED;
        project.reviewedAt = new Date();
        project.reviewNote = typeof reviewNote === 'string' ? reviewNote.trim() : '';
        project.committeeStatus =
            action === 'accept' ? COMMITTEE_STATUSES.PENDING : COMMITTEE_STATUSES.NOT_STARTED;
        project.committeeReviewedAt = undefined;
        project.committeeNote = '';

        await project.save();

        const updatedProject = await projectModel
            .findById(project._id)
            .populate('students', 'name email role department');

        return res.status(200).json({
            success: true,
            message: `Proposal ${action}ed successfully`,
            data: updatedProject
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to review proposal',
            error: error.message
        });
    }
}

async function reviewCommitteeProposal(req, res) {
    const { projectId } = req.params;
    const { action, committeeNote } = req.body;

    if (!projectId || !action) {
        return res.status(400).json({
            success: false,
            message: 'Project id and action are required'
        });
    }

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid action. Use "approve" or "reject"'
        });
    }

    try {
        const project = await projectModel.findById(projectId);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        const currentProposalStatus = project.proposalStatus || PROPOSAL_STATUSES.PENDING;
        if (currentProposalStatus !== PROPOSAL_STATUSES.ACCEPTED) {
            return res.status(400).json({
                success: false,
                message: 'Committee review is available only after teacher acceptance'
            });
        }

        const currentCommitteeStatus = project.committeeStatus || COMMITTEE_STATUSES.PENDING;
        if (![COMMITTEE_STATUSES.PENDING, COMMITTEE_STATUSES.NOT_STARTED].includes(currentCommitteeStatus)) {
            return res.status(400).json({
                success: false,
                message: `Committee decision already ${currentCommitteeStatus}`
            });
        }

        project.committeeStatus =
            action === 'approve' ? COMMITTEE_STATUSES.APPROVED : COMMITTEE_STATUSES.REJECTED;
        project.committeeReviewedAt = new Date();
        project.committeeNote = typeof committeeNote === 'string' ? committeeNote.trim() : '';

        await project.save();

        const updatedProject = await projectModel
            .findById(project._id)
            .populate('students', 'name email role department');

        return res.status(200).json({
            success: true,
            message: `Committee ${action}d the proposal successfully`,
            data: updatedProject
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to process committee decision',
            error: error.message
        });
    }
}

async function getLatestStudentProposal(req, res) {
    const { studentId } = req.params;

    if (!studentId) {
        return res.status(400).json({
            success: false,
            message: 'Student id is required'
        });
    }

    try {
        const student = await userModel
            .findOne({ _id: studentId, role: 'student' })
            .select('_id name email');

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        const latestProposalRaw = await projectModel
            .findOne({ students: studentId })
            .populate('students', 'name email role department')
            .sort({ createdAt: -1 });

        const activeRequestRaw = await projectModel
            .findOne({
                students: studentId,
                $or: [
                    { proposalStatus: { $in: [PROPOSAL_STATUSES.PENDING, PROPOSAL_STATUSES.ACCEPTED] } },
                    { proposalStatus: { $exists: false } }
                ]
            })
            .populate('students', 'name email role department')
            .sort({ createdAt: -1 });

        const latestProposal = normalizeProjectStatus(latestProposalRaw);
        const activeRequest = normalizeProjectStatus(activeRequestRaw);
        const proposalForStudentView = activeRequest || latestProposal;

        return res.status(200).json({
            success: true,
            message: 'Latest student proposal fetched successfully',
            data: proposalForStudentView,
            hasActiveRequest: Boolean(activeRequest),
            activeRequestStatus: activeRequest?.proposalStatus || (activeRequest ? PROPOSAL_STATUSES.PENDING : null),
            activeRequestTeacher: activeRequest?.supervisor || null
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch latest student proposal',
            error: error.message
        });
    }
}

async function getStudentDashboard(req, res) {
    const { studentId } = req.params;

    if (!studentId) {
        return res.status(400).json({
            success: false,
            message: 'Student id is required'
        });
    }

    try {
        const student = await userModel
            .findOne({ _id: studentId, role: 'student' })
            .select('_id name email department');

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        const workspace = await getOrCreateStudentWorkspace(studentId);

        const latestProposalRaw = await projectModel
            .findOne({ students: studentId })
            .sort({ createdAt: -1 });

        const activeRequestRaw = await projectModel
            .findOne({
                students: studentId,
                $or: [
                    { proposalStatus: { $in: [PROPOSAL_STATUSES.PENDING, PROPOSAL_STATUSES.ACCEPTED] } },
                    { proposalStatus: { $exists: false } }
                ]
            })
            .sort({ createdAt: -1 });

        const latestProposal = normalizeProjectStatus(latestProposalRaw);
        const activeRequest = normalizeProjectStatus(activeRequestRaw);
        const selectedProject = activeRequest || latestProposal;

        let supervisor = null;
        if (selectedProject?.supervisorId) {
            const teacher = await userModel
                .findById(selectedProject.supervisorId)
                .select('_id name email department');
            if (teacher) {
                supervisor = teacher;
            }
        }

        if (!supervisor && selectedProject?.supervisor) {
            const teacherByName = await userModel
                .findOne({ name: selectedProject.supervisor, role: 'teacher' })
                .select('_id name email department');
            if (teacherByName) supervisor = teacherByName;
        }

        const now = new Date();
        const tasks = [...(workspace.tasks || [])].sort((a, b) => {
            const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            return aDate - bDate;
        });

        const upcomingDeadlines = tasks
            .filter((task) => task.status !== 'completed' && task.dueDate)
            .slice(0, 5)
            .map((task) => ({
                id: task._id,
                title: task.title,
                dueDate: task.dueDate,
                priority: task.priority,
                isOverdue: new Date(task.dueDate) < now
            }));

        const recentActivities = [...(workspace.activities || [])]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 8);

        const pendingTasks = tasks.filter((task) => task.status !== 'completed');
        const completedTasks = tasks.filter((task) => task.status === 'completed');
        const messages = [...(workspace.messages || [])].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        return res.status(200).json({
            success: true,
            message: 'Student dashboard fetched successfully',
            data: {
                student,
                project: selectedProject,
                supervisor,
                tasks,
                pendingTasks,
                completedTasks,
                submissions: (workspace.submissions || []).sort(
                    (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
                ),
                resources: workspace.resources || [],
                recentActivities,
                messages,
                upcomingDeadlines,
                timeline: getTimelineFromProject(selectedProject),
                stats: {
                    totalTasks: tasks.length,
                    completedTasks: completedTasks.length,
                    pendingTasks: pendingTasks.length,
                    submissions: (workspace.submissions || []).length
                }
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch student dashboard',
            error: error.message
        });
    }
}

async function addStudentTask(req, res) {
    const { studentId } = req.params;
    const { title, description, priority, dueDate } = req.body;

    if (!studentId || !title) {
        return res.status(400).json({
            success: false,
            message: 'Student id and task title are required'
        });
    }

    try {
        const student = await userModel.findOne({ _id: studentId, role: 'student' }).select('_id');
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        const workspace = await getOrCreateStudentWorkspace(studentId);
        workspace.tasks.push({
            title: title.trim(),
            description: typeof description === 'string' ? description.trim() : '',
            priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
            dueDate: dueDate ? new Date(dueDate) : null
        });
        workspace.activities.push({
            type: 'task',
            message: `New task added: ${title.trim()}`,
            createdAt: new Date()
        });
        await workspace.save();

        return res.status(201).json({
            success: true,
            message: 'Task added successfully',
            data: workspace.tasks[workspace.tasks.length - 1]
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to add task',
            error: error.message
        });
    }
}

async function updateStudentTaskStatus(req, res) {
    const { studentId, taskId } = req.params;
    const { status } = req.body;

    if (!studentId || !taskId || !status) {
        return res.status(400).json({
            success: false,
            message: 'Student id, task id and status are required'
        });
    }

    if (!['pending', 'completed'].includes(status)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid status'
        });
    }

    try {
        const workspace = await getOrCreateStudentWorkspace(studentId);
        const task = workspace.tasks.id(taskId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        task.status = status;
        task.completedAt = status === 'completed' ? new Date() : undefined;

        workspace.activities.push({
            type: 'task',
            message: `Task "${task.title}" marked as ${status.replace('_', ' ')}`,
            createdAt: new Date()
        });

        await workspace.save();

        return res.status(200).json({
            success: true,
            message: 'Task status updated successfully',
            data: task
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to update task status',
            error: error.message
        });
    }
}

async function submitStudentWork(req, res) {
    const { studentId } = req.params;
    const { title, description } = req.body;

    if (!studentId || !title) {
        return res.status(400).json({
            success: false,
            message: 'Student id and submission title are required'
        });
    }

    try {
        const student = await userModel.findOne({ _id: studentId, role: 'student' }).select('_id');
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        const uploadedDocuments = [];
        for (const file of req.files || []) {
            const uploadedDocument = await uploadFileToImageKit(file, `/fyp/submissions/${studentId}`);
            uploadedDocuments.push(uploadedDocument);
        }

        const workspace = await getOrCreateStudentWorkspace(studentId);
        workspace.submissions.push({
            title: title.trim(),
            description: typeof description === 'string' ? description.trim() : '',
            documents: uploadedDocuments,
            submittedAt: new Date()
        });
        workspace.activities.push({
            type: 'submission',
            message: `Submitted work: ${title.trim()}`,
            createdAt: new Date()
        });

        await workspace.save();

        return res.status(201).json({
            success: true,
            message: 'Work submitted successfully',
            data: workspace.submissions[workspace.submissions.length - 1]
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to submit work',
            error: error.message
        });
    }
}

async function addStudentResource(req, res) {
    const { studentId } = req.params;
    const { title, category, url } = req.body;

    if (!studentId || !title || !url) {
        return res.status(400).json({
            success: false,
            message: 'Student id, title and url are required'
        });
    }

    try {
        const workspace = await getOrCreateStudentWorkspace(studentId);
        workspace.resources.push({
            title: title.trim(),
            category: typeof category === 'string' && category.trim() ? category.trim() : 'general',
            url: url.trim()
        });
        workspace.activities.push({
            type: 'resource',
            message: `New resource added: ${title.trim()}`,
            createdAt: new Date()
        });
        await workspace.save();

        return res.status(201).json({
            success: true,
            message: 'Resource added successfully',
            data: workspace.resources[workspace.resources.length - 1]
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to add resource',
            error: error.message
        });
    }
}

async function sendMessageToSupervisor(req, res) {
    const { studentId } = req.params;
    const { message } = req.body;

    if (!studentId || !message || !message.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Student id and message are required'
        });
    }

    try {
        const workspace = await getOrCreateStudentWorkspace(studentId);
        workspace.activities.push({
            type: 'message',
            message: `Message sent to supervisor: ${message.trim()}`,
            createdAt: new Date()
        });
        workspace.messages.push({
            senderRole: 'student',
            text: message.trim(),
            createdAt: new Date()
        });
        await workspace.save();

        return res.status(200).json({
            success: true,
            message: 'Message logged successfully'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to send message',
            error: error.message
        });
    }
}

function getWorkspaceStudentUpdateMeta(workspace) {
    if (!workspace) {
        return { count: 0, lastAt: null };
    }

    const studentMessageDates = (workspace.messages || [])
        .filter((message) => message.senderRole === 'student')
        .map((message) => new Date(message.createdAt).getTime())
        .filter((value) => !Number.isNaN(value));

    const submissionDates = (workspace.submissions || [])
        .map((submission) => new Date(submission.submittedAt || submission.createdAt).getTime())
        .filter((value) => !Number.isNaN(value));

    const taskAndResourceDates = (workspace.activities || [])
        .filter((activity) => ['task', 'resource'].includes(activity.type))
        .map((activity) => new Date(activity.createdAt).getTime())
        .filter((value) => !Number.isNaN(value));

    const merged = [...studentMessageDates, ...submissionDates, ...taskAndResourceDates];
    if (merged.length === 0) {
        return { count: 0, lastAt: null };
    }

    return {
        count: merged.length,
        lastAt: new Date(Math.max(...merged))
    };
}

async function sendTeacherMessageToStudent(req, res) {
    const { teacherId, studentId } = req.params;
    const { message } = req.body;

    if (!teacherId || !studentId || !message || !message.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Teacher id, student id and message are required'
        });
    }

    try {
        const teacher = await userModel
            .findOne({ _id: teacherId, role: 'teacher' })
            .select('_id name');

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        const project = await projectModel.findOne({
            students: studentId,
            proposalStatus: { $in: [PROPOSAL_STATUSES.PENDING, PROPOSAL_STATUSES.ACCEPTED] },
            $or: [
                { supervisorId: teacher._id },
                { supervisor: teacher.name }
            ]
        });

        if (!project) {
            return res.status(403).json({
                success: false,
                message: 'You are not assigned as supervisor for this student'
            });
        }

        const workspace = await getOrCreateStudentWorkspace(studentId);
        workspace.messages.push({
            senderRole: 'teacher',
            text: message.trim(),
            createdAt: new Date()
        });
        workspace.activities.push({
            type: 'message',
            message: `Teacher replied: ${message.trim()}`,
            createdAt: new Date()
        });
        await workspace.save();

        return res.status(200).json({
            success: true,
            message: 'Reply sent successfully'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to send teacher reply',
            error: error.message
        });
    }
}

async function getTeacherDashboardData(req, res) {
    const { teacherId } = req.params;

    if (!teacherId) {
        return res.status(400).json({
            success: false,
            message: 'Teacher id is required'
        });
    }

    try {
        const teacher = await userModel
            .findOne({ _id: teacherId, role: 'teacher' })
            .select('_id name email');

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        const projects = await projectModel
            .find({
                $or: [
                    { supervisorId: teacher._id },
                    { supervisor: teacher.name }
                ]
            })
            .populate('students', 'name email department')
            .sort({ createdAt: -1 });

        const visibleProjects = projects.filter(
            (project) => (project.proposalStatus || PROPOSAL_STATUSES.PENDING) !== PROPOSAL_STATUSES.REJECTED
        );

        const uniqueStudentIds = [...new Set(
            visibleProjects.map((project) => String(project?.students?._id || '')).filter(Boolean)
        )];

        const workspaces = await studentWorkspaceModel.find({
            student: { $in: uniqueStudentIds }
        });
        const workspaceMap = new Map(workspaces.map((workspace) => [String(workspace.student), workspace]));

        const students = uniqueStudentIds.map((studentId) => {
            const project = projects.find((item) => String(item?.students?._id || '') === studentId);
            const workspace = workspaceMap.get(studentId);
            const updateMeta = getWorkspaceStudentUpdateMeta(workspace);

            const pendingTasks = (workspace?.tasks || []).filter((task) => task.status !== 'completed').length;
            const completedTasks = (workspace?.tasks || []).filter((task) => task.status === 'completed').length;
            const submissions = (workspace?.submissions || []).length;

            return {
                studentId,
                name: project?.students?.name || 'Unknown',
                email: project?.students?.email || '',
                department: project?.students?.department || '',
                projectId: project?._id || null,
                projectTitle: project?.title || '',
                projectStatus: project?.proposalStatus || PROPOSAL_STATUSES.PENDING,
                committeeStatus: project?.committeeStatus || COMMITTEE_STATUSES.NOT_STARTED,
                pendingTasks,
                completedTasks,
                submissions,
                studentUpdateCount: updateMeta.count,
                lastStudentUpdateAt: updateMeta.lastAt
            };
        });

        const recentActivities = students
            .flatMap((student) => {
                const workspace = workspaceMap.get(student.studentId);
                return (workspace?.activities || []).map((activity) => ({
                    ...(typeof activity.toObject === 'function' ? activity.toObject() : activity),
                    studentName: student.name
                }));
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 12);

        const summary = {
            assignedStudents: uniqueStudentIds.length,
            pendingReviews: projects.filter(
                (project) => (project.proposalStatus || PROPOSAL_STATUSES.PENDING) === PROPOSAL_STATUSES.PENDING
            ).length,
            approvedProjects: projects.filter(
                (project) => (project.proposalStatus || PROPOSAL_STATUSES.PENDING) === PROPOSAL_STATUSES.ACCEPTED
            ).length,
            committeePending: projects.filter((project) => {
                const proposalStatus = project.proposalStatus || PROPOSAL_STATUSES.PENDING;
                const committeeStatus = project.committeeStatus || COMMITTEE_STATUSES.NOT_STARTED;
                return proposalStatus === PROPOSAL_STATUSES.ACCEPTED &&
                    [COMMITTEE_STATUSES.NOT_STARTED, COMMITTEE_STATUSES.PENDING].includes(committeeStatus);
            }).length,
            studentNotifications: students.reduce((acc, student) => acc + (student.studentUpdateCount || 0), 0)
        };

        return res.status(200).json({
            success: true,
            message: 'Teacher dashboard fetched successfully',
            data: {
                teacher,
                summary,
                students,
                recentActivities
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch teacher dashboard',
            error: error.message
        });
    }
}

async function getTeacherReports(req, res) {
    const { teacherId } = req.params;

    if (!teacherId) {
        return res.status(400).json({
            success: false,
            message: 'Teacher id is required'
        });
    }

    try {
        const teacher = await userModel
            .findOne({ _id: teacherId, role: 'teacher' })
            .select('_id name email');

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        const projects = await projectModel
            .find({
                $or: [
                    { supervisorId: teacher._id },
                    { supervisor: teacher.name }
                ]
            })
            .populate('students', 'name email department')
            .sort({ createdAt: -1 });

        const visibleProjects = projects.filter(
            (project) => (project.proposalStatus || PROPOSAL_STATUSES.PENDING) !== PROPOSAL_STATUSES.REJECTED
        );

        const uniqueStudentIds = [...new Set(
            visibleProjects.map((project) => String(project?.students?._id || '')).filter(Boolean)
        )];

        const workspaces = await studentWorkspaceModel.find({
            student: { $in: uniqueStudentIds }
        });
        const workspaceMap = new Map(workspaces.map((workspace) => [String(workspace.student), workspace]));

        let totalSubmissions = 0;
        let totalTasks = 0;
        let completedTasks = 0;

        const studentRows = uniqueStudentIds.map((studentId) => {
            const project = visibleProjects.find((item) => String(item?.students?._id || '') === studentId);
            const workspace = workspaceMap.get(studentId);

            const pendingTaskCount = (workspace?.tasks || []).filter((task) => task.status !== 'completed').length;
            const completedTaskCount = (workspace?.tasks || []).filter((task) => task.status === 'completed').length;
            const submissionCount = (workspace?.submissions || []).length;

            totalSubmissions += submissionCount;
            totalTasks += pendingTaskCount + completedTaskCount;
            completedTasks += completedTaskCount;

            const latestSubmission = [...(workspace?.submissions || [])]
                .sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt))[0];

            const latestStudentMessage = [...(workspace?.messages || [])]
                .filter((message) => message.senderRole === 'student')
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

            return {
                studentId,
                name: project?.students?.name || 'Unknown',
                email: project?.students?.email || '',
                department: project?.students?.department || '',
                projectTitle: project?.title || '',
                proposalStatus: project?.proposalStatus || PROPOSAL_STATUSES.PENDING,
                committeeStatus: project?.committeeStatus || COMMITTEE_STATUSES.NOT_STARTED,
                pendingTaskCount,
                completedTaskCount,
                submissionCount,
                completionRate:
                    pendingTaskCount + completedTaskCount > 0
                        ? Math.round((completedTaskCount / (pendingTaskCount + completedTaskCount)) * 100)
                        : 0,
                lastSubmissionAt: latestSubmission?.submittedAt || latestSubmission?.createdAt || null,
                lastStudentMessageAt: latestStudentMessage?.createdAt || null,
                lastUpdatedAt: project?.updatedAt || project?.createdAt || null
            };
        });

        const monthMap = new Map();
        const now = new Date();
        for (let i = 5; i >= 0; i -= 1) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthMap.set(key, {
                key,
                label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
                submissions: 0,
                studentMessages: 0,
                tasksCompleted: 0
            });
        }

        workspaces.forEach((workspace) => {
            (workspace.submissions || []).forEach((submission) => {
                const d = new Date(submission.submittedAt || submission.createdAt);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (monthMap.has(key)) monthMap.get(key).submissions += 1;
            });

            (workspace.messages || []).forEach((message) => {
                if (message.senderRole !== 'student') return;
                const d = new Date(message.createdAt);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (monthMap.has(key)) monthMap.get(key).studentMessages += 1;
            });

            (workspace.tasks || []).forEach((task) => {
                if (task.status !== 'completed') return;
                const d = new Date(task.completedAt || task.updatedAt || task.createdAt);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (monthMap.has(key)) monthMap.get(key).tasksCompleted += 1;
            });
        });

        const summary = {
            totalStudents: uniqueStudentIds.length,
            totalProjects: visibleProjects.length,
            pendingProposals: visibleProjects.filter(
                (project) => (project.proposalStatus || PROPOSAL_STATUSES.PENDING) === PROPOSAL_STATUSES.PENDING
            ).length,
            acceptedProposals: visibleProjects.filter(
                (project) => (project.proposalStatus || PROPOSAL_STATUSES.PENDING) === PROPOSAL_STATUSES.ACCEPTED
            ).length,
            committeePending: visibleProjects.filter((project) => {
                const proposalStatus = project.proposalStatus || PROPOSAL_STATUSES.PENDING;
                const committeeStatus = project.committeeStatus || COMMITTEE_STATUSES.NOT_STARTED;
                return proposalStatus === PROPOSAL_STATUSES.ACCEPTED &&
                    [COMMITTEE_STATUSES.NOT_STARTED, COMMITTEE_STATUSES.PENDING].includes(committeeStatus);
            }).length,
            committeeApproved: visibleProjects.filter(
                (project) => (project.committeeStatus || COMMITTEE_STATUSES.NOT_STARTED) === COMMITTEE_STATUSES.APPROVED
            ).length,
            totalSubmissions,
            totalTasks,
            completedTasks,
            overallCompletionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
        };

        return res.status(200).json({
            success: true,
            message: 'Teacher reports fetched successfully',
            data: {
                teacher,
                summary,
                students: studentRows.sort((a, b) => new Date(b.lastUpdatedAt || 0) - new Date(a.lastUpdatedAt || 0)),
                monthlyActivity: Array.from(monthMap.values())
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch teacher reports',
            error: error.message
        });
    }
}

async function getStudentWorkspaceForTeacher(req, res) {
    const { teacherId, studentId } = req.params;

    if (!teacherId || !studentId) {
        return res.status(400).json({
            success: false,
            message: 'Teacher id and student id are required'
        });
    }

    try {
        const teacher = await userModel
            .findOne({ _id: teacherId, role: 'teacher' })
            .select('_id name');

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        const project = await projectModel
            .findOne({
                students: studentId,
                proposalStatus: { $in: [PROPOSAL_STATUSES.PENDING, PROPOSAL_STATUSES.ACCEPTED] },
                $or: [
                    { supervisorId: teacher._id },
                    { supervisor: teacher.name }
                ]
            })
            .sort({ createdAt: -1 });

        if (!project) {
            return res.status(403).json({
                success: false,
                message: 'You are not assigned as supervisor for this student'
            });
        }

        const workspace = await getOrCreateStudentWorkspace(studentId);
        const student = await userModel
            .findOne({ _id: studentId, role: 'student' })
            .select('_id name email department');

        const pendingTasks = (workspace.tasks || []).filter((task) => task.status !== 'completed');
        const completedTasks = (workspace.tasks || []).filter((task) => task.status === 'completed');

        return res.status(200).json({
            success: true,
            message: 'Student workspace fetched successfully',
            data: {
                student,
                project: normalizeProjectStatus(project),
                pendingTasks,
                completedTasks,
                submissions: [...(workspace.submissions || [])].sort(
                    (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
                ),
                resources: workspace.resources || [],
                messages: [...(workspace.messages || [])].sort(
                    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
                ),
                recentActivities: [...(workspace.activities || [])]
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 12)
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch student workspace for teacher',
            error: error.message
        });
    }
}

async function getAllProjects(req, res) {
    try {
        const projects = await projectModel
            .find()
            .populate('students', 'name email role department')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: 'Projects fetched successfully',
            data: projects
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch projects',
            error: error.message
        });
    }
}

async function getProjectsByTeacher(req, res) {
    const { teacherId } = req.params;

    if (!teacherId) {
        return res.status(400).json({
            success: false,
            message: 'Teacher id is required'
        });
    }

    try {
        const teacher = await userModel
            .findOne({ _id: teacherId, role: 'teacher' })
            .select('_id name');

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        const projects = await projectModel
            .find({
                $or: [
                    { supervisorId: teacher._id },
                    { supervisor: teacher.name }
                ]
            })
            .populate('students', 'name email role department')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: 'Teacher projects fetched successfully',
            data: projects
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch teacher projects',
            error: error.message
        });
    }
}


async function getAllTeachers(req, res) {
    try {
        const teachers = await userModel
            .find({ role: 'teacher' })
            .select('name email department status');

        const teachersWithAvailability = await Promise.all(
            teachers.map(async (teacher) => {
                const acceptedCount = await projectModel.countDocuments({
                    proposalStatus: PROPOSAL_STATUSES.ACCEPTED,
                    $or: [
                        { supervisorId: teacher._id },
                        { supervisor: teacher.name }
                    ]
                });

                const remainingSlots = Math.max(SUPERVISOR_ACCEPT_LIMIT - acceptedCount, 0);
                const isAvailable = teacher.status !== 'inactive' && acceptedCount < SUPERVISOR_ACCEPT_LIMIT;

                return {
                    ...teacher.toObject(),
                    activeAcceptedCount: acceptedCount,
                    remainingSlots,
                    availabilityStatus: isAvailable ? 'available' : 'not_available',
                    availabilityLabel: isAvailable ? 'Available' : 'Not Available'
                };
            })
        );

        return res.status(200).json({
            success: true,
            message: 'Teachers fetched successfully',
            data: teachersWithAvailability
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch teachers',
            error: error.message
        });
    }
}


module.exports = {
    createUser,
    getAllUser,
    EidtUser,
    DeleteUser,
    projectDetail,
    getAllProjects,
    getProjectsByTeacher,
    getAllTeachers,
    reviewProjectProposal,
    reviewCommitteeProposal,
    getLatestStudentProposal,
    getStudentDashboard,
    addStudentTask,
    updateStudentTaskStatus,
    submitStudentWork,
    addStudentResource,
    sendMessageToSupervisor,
    getStudentWorkspaceForTeacher,
    sendTeacherMessageToStudent,
    getTeacherDashboardData,
    getTeacherReports
};
