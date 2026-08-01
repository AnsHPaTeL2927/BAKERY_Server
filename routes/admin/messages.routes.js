const express = require('express');
const controller = require('../../controllers/admin/messagesController');
const { validate } = require('../../middleware/validate');
const { listContactMessagesSchema, updateContactMessageSchema } = require('../../validators/contactValidators');

const router = express.Router();

router.get('/', validate(listContactMessagesSchema), controller.list);
router.patch('/:id/status', validate(updateContactMessageSchema), controller.updateStatus);

module.exports = router;
