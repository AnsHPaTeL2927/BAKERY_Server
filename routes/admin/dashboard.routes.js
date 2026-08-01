const express = require('express');
const controller = require('../../controllers/admin/dashboardController');

const router = express.Router();

router.get('/', controller.get);

module.exports = router;
