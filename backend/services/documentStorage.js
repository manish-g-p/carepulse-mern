const fs = require("fs");
const path = require("path");

// Medical-document file storage: Cloudinary when configured (free tier, set
// CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET or a single CLOUDINARY_URL),
// otherwise local disk under uploads/documents (served statically at
// /uploads like the registration ID uploads). Uploads come in as buffers
// (multer memory storage) so both backends take the same input.

const localDir = path.join(__dirname, "..", "uploads", "documents");

// A set-but-malformed CLOUDINARY_URL (e.g. just the API key pasted in)
// must not break uploads -- treat it as unconfigured and fall back to
// local disk, with a one-time warning explaining the expected format.
let warnedBadUrl = false;
const isCloudinaryConfigured = () => {
  const url = process.env.CLOUDINARY_URL;
  if (url) {
    if (url.startsWith("cloudinary://")) return true;
    if (!warnedBadUrl) {
      warnedBadUrl = true;
      console.warn(
        "[documents] CLOUDINARY_URL is set but is not a cloudinary:// URL " +
          "(expected cloudinary://<api_key>:<api_secret>@<cloud_name> from the " +
          "Cloudinary dashboard). Falling back to local disk storage."
      );
    }
    return false;
  }
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
};

// Lazy-required so the backend still boots if the package isn't installed
// yet in an old checkout.
let cloudinary = null;
const getCloudinary = () => {
  if (!cloudinary) {
    cloudinary = require("cloudinary").v2;
    if (!process.env.CLOUDINARY_URL) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
  }
  return cloudinary;
};

// Stores a file buffer; returns the fields MedicalDocument persists.
const storeDocument = async (buffer, originalName, mimeType) => {
  if (isCloudinaryConfigured()) {
    const cld = getCloudinary();
    // PDFs and other non-images must go up as "raw" or delivery 401s on
    // free accounts; images stay images so previews get transformations.
    const resourceType = mimeType.startsWith("image/") ? "image" : "raw";
    const uploaded = await new Promise((resolve, reject) => {
      const stream = cld.uploader.upload_stream(
        { folder: "carepulse-documents", resource_type: resourceType },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(buffer);
    });
    return {
      storage: "cloudinary",
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      resourceType,
      localName: "",
    };
  }

  fs.mkdirSync(localDir, { recursive: true });
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(originalName)}`;
  fs.writeFileSync(path.join(localDir, unique), buffer);
  return {
    storage: "local",
    url: `/uploads/documents/${unique}`,
    publicId: "",
    resourceType: "",
    localName: unique,
  };
};

// Best-effort file removal; the DB record is deleted regardless (an
// orphaned blob is better than a dangling record pointing nowhere).
const removeDocumentFile = async (doc) => {
  try {
    if (doc.storage === "cloudinary" && doc.publicId) {
      // invalidate purges the CDN edge caches too -- without it a deleted
      // medical document keeps serving from cache for up to an hour.
      await getCloudinary().uploader.destroy(doc.publicId, {
        resource_type: doc.resourceType || "image",
        invalidate: true,
      });
    } else if (doc.storage === "local" && doc.localName) {
      fs.unlinkSync(path.join(localDir, doc.localName));
    }
  } catch (error) {
    console.warn(`[documents] could not remove stored file: ${error.message}`);
  }
};

module.exports = { storeDocument, removeDocumentFile, isCloudinaryConfigured };
