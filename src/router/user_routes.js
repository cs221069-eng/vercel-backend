const express = require('express');
const router = express.Router();
const userController = require('../controller/user_controller');
const upload = require('../utils/multer');
const { requireAuth, authorizeRoles } = require('../middleware/auth_middleware');


router.post('/create/9165', requireAuth, authorizeRoles('admin'), userController.createUser);
router.get('/all/9165', requireAuth, authorizeRoles('admin'), userController.getAllUser);
router.put('/edit/:id/9165', requireAuth, authorizeRoles('admin'), userController.EidtUser);
router.delete('/delete/:id/9165', requireAuth, authorizeRoles('admin'), userController.DeleteUser);
router.post('/project/:id/9165', upload.array('documents', 5), userController.projectDetail);
router.get('/teacher/all/9165', userController.getAllTeachers);
router.get('/project/all/9165', userController.getAllProjects);
router.get('/project/teacher/:teacherId/9165', userController.getProjectsByTeacher);
router.patch('/project/:projectId/review/:teacherId/9165', userController.reviewProjectProposal);
router.patch('/project/:projectId/committee/9165', requireAuth, authorizeRoles('admin'), userController.reviewCommitteeProposal);
router.get('/project/student/:studentId/latest/9165', userController.getLatestStudentProposal);
router.get('/student/dashboard/:studentId/9165', userController.getStudentDashboard);
router.post('/student/dashboard/task/:studentId/9165', userController.addStudentTask);
router.patch('/student/dashboard/task/:studentId/:taskId/9165', userController.updateStudentTaskStatus);
router.post('/student/dashboard/work/:studentId/9165', upload.array('documents', 5), userController.submitStudentWork);
router.post('/student/dashboard/resource/:studentId/9165', userController.addStudentResource);
router.post('/student/dashboard/message/:studentId/9165', userController.sendMessageToSupervisor);
router.get('/teacher/workspace/:teacherId/student/:studentId/9165', userController.getStudentWorkspaceForTeacher);
router.post('/teacher/message/:teacherId/student/:studentId/9165', userController.sendTeacherMessageToStudent);
router.get('/teacher/dashboard/:teacherId/9165', userController.getTeacherDashboardData);
router.get('/teacher/reports/:teacherId/9165', userController.getTeacherReports);

module.exports = router;
