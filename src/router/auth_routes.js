const express = require('express');
const router = express.Router();
const LoginRouter = require('../controller/login_controller');


router.post('/login/9165',LoginRouter.Login);
router.post('/logout/9165', LoginRouter.Logout);



module.exports = router;
