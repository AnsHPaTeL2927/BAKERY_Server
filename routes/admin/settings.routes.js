const express = require('express');
const controller = require('../../controllers/admin/settingsController');
const { validate } = require('../../middleware/validate');
const { upload } = require('../../middleware/upload');
const { updateSettingsSchema } = require('../../validators/settingsValidators');

const router = express.Router();

router.get('/', controller.get);
router.put(
  '/',
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 },
  ]),
  validate(updateSettingsSchema),
  controller.update,
);

module.exports = router;
