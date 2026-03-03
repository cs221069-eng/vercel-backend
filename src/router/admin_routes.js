const express = require('express');
const router = express.Router();
const AdminRouter = require('../controller/admin_controller');
const { requireAuth, authorizeRoles } = require('../middleware/auth_middleware');


router.post('/create/9165', AdminRouter.CreateAdmin);
router.get('/admins/9165', requireAuth, authorizeRoles('admin'), AdminRouter.getAllAdmins);
router.get('/admin/dashboard/9165', requireAuth, authorizeRoles('admin'), AdminRouter.getAdminDashboardSummary);



module.exports = router;
