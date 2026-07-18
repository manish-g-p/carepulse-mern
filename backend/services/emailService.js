const nodemailer = require("nodemailer");

// Outbound email for appointment reminders. Free-tier friendly: any SMTP
// works, the documented path is a Gmail app password (SMTP_HOST defaults to
// Gmail). Unconfigured = the feature degrades gracefully -- reminder sweeps
// report "email not configured" instead of throwing, matching how the
// translate server and broker degrade elsewhere in the app.

const isEmailConfigured = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

const sendMail = async ({ to, subject, text }) => {
  if (!isEmailConfigured()) {
    throw new Error("Email is not configured (set SMTP_USER and SMTP_PASS)");
  }
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
};

module.exports = { isEmailConfigured, sendMail };
