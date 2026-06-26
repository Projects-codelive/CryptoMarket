const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOtpEmail(email, otp, purpose) {
  const subjectMap = {
    'register': `Your NiveshBay Registration OTP - ${otp}`,
    'reset-password': `Your NiveshBay Password Reset OTP - ${otp}`,
    'login': `Your NiveshBay Login OTP - ${otp}`
  };
  const subject = subjectMap[purpose] || `Your NiveshBay OTP - ${otp}`;

  const body = `Hi,

Your OTP for NiveshBay is: ${otp}

This OTP is valid for 10 minutes only.

Do not share this OTP with anyone.

Team NiveshBay`;

  const fromName = 'NiveshBay';
  const fromEmail = process.env.EMAIL_USER;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: email,
    subject,
    text: body,
  });
}

module.exports = { sendOtpEmail };
