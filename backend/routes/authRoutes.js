const express = require("express");
const { adminLogin, doctorRegister, doctorLogin } = require("../controllers/authController");

const router = express.Router();

router.post("/admin-login", adminLogin);
router.post("/doctor/register", doctorRegister);
router.post("/doctor/login", doctorLogin);

module.exports = router;
