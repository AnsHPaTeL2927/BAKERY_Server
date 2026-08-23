const express = require('express');
const controller = require('../../controllers/admin/aboutController');
const { validate } = require('../../middleware/validate');
const { upload } = require('../../middleware/upload');
const { updateAboutSchema } = require('../../validators/aboutValidators');

const router = express.Router();

router.get('/', controller.get);
router.put(
  '/',
  upload.fields([
    { name: 'chefPhoto', maxCount: 1 },
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
  ]),
  validate(updateAboutSchema),
  controller.update,
);

module.exports = router;
