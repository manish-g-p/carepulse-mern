const express = require("express");
const { requireAuth } = require("../middleware/auth");
const uploadMemory = require("../middleware/uploadMemory");
const {
  listDocuments,
  uploadDocument,
  deleteDocument,
} = require("../controllers/documentController");

const router = express.Router();

router.use(requireAuth("doctor"));
router.get("/", listDocuments);
router.post("/", uploadMemory.single("file"), uploadDocument);
router.delete("/:id", deleteDocument);

module.exports = router;
