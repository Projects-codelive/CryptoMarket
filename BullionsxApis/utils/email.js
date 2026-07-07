const https = require('https');

const USE_SMTP = !!process.env.EMAIL_HOST;

let transporter = null;

if (USE_SMTP) {
  const nodemailer = require('nodemailer');
  const dns = require('dns');
  const { promisify } = require('util');
  const resolve4 = promisify(dns.resolve4);

  (async () => {
    let host = process.env.EMAIL_HOST;
    try {
      const ips = await resolve4(host);
      if (ips.length) host = ips[0];
    } catch (_) { /* use hostname */ }

    transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: parseInt(process.env.EMAIL_PORT || '587') === 465,
      requireTLS: parseInt(process.env.EMAIL_PORT || '587') !== 465,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      tls: { rejectUnauthorized: false },
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  })();
}

function sendViaMailtrap(email, otp, purpose) {
  const subjects = {
    'register': `Your NiveshBay Registration OTP - ${otp}`,
    'reset-password': `Your NiveshBay Password Reset OTP - ${otp}`,
    'login': `Your NiveshBay Login OTP - ${otp}`
  };

  const body = `Hi,\n\nYour OTP for NiveshBay is: ${otp}\n\nThis OTP is valid for 10 minutes only.\n\nDo not share this OTP with anyone.\n\nTeam NiveshBay`;

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      from: { email: process.env.EMAIL_FROM, name: 'NiveshBay' },
      to: [{ email }],
      subject: subjects[purpose] || `Your NiveshBay OTP - ${otp}`,
      text: body,
    });

    const req = https.request({
      hostname: 'send.api.mailtrap.io',
      path: '/api/send',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MAILTRAP_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let chunk = '';
      res.on('data', (c) => chunk += c);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(chunk));
        else reject(new Error(`Mailtrap API ${res.statusCode}: ${chunk}`));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function sendOtpEmail(email, otp, purpose) {
  if (process.env.MAILTRAP_API_TOKEN) {
    return sendViaMailtrap(email, otp, purpose);
  }
  if (transporter) {
    const subjects = {
      'register': `Your NiveshBay Registration OTP - ${otp}`,
      'reset-password': `Your NiveshBay Password Reset OTP - ${otp}`,
      'login': `Your NiveshBay Login OTP - ${otp}`
    };
    const body = `Hi,\n\nYour OTP for NiveshBay is: ${otp}\n\nThis OTP is valid for 10 minutes only.\n\nDo not share this OTP with anyone.\n\nTeam NiveshBay`;
    await transporter.sendMail({
      from: `"NiveshBay" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subjects[purpose] || `Your NiveshBay OTP - ${otp}`,
      text: body,
    });
    return;
  }
  throw new Error('No email method configured. Set MAILTRAP_API_TOKEN or EMAIL_HOST');
}

module.exports = { sendOtpEmail };
