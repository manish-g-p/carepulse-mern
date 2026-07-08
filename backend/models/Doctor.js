const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const DoctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    specialization: { type: String, default: "" },
  },
  { timestamps: true }
);

DoctorSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model("Doctor", DoctorSchema);
