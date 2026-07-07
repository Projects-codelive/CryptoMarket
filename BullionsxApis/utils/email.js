const https = require('https');

const USE_SMTP = !!process.env.EMAIL_HOST;

let transporter = null;

if (USE_SMTP) {
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
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
}

function getEmailTemplate(otp, purpose) {
  const subjects = {
    'register': `Your NiveshBay Registration OTP - ${otp}`,
    'reset-password': `Your NiveshBay Password Reset OTP - ${otp}`,
    'login': `Your NiveshBay Login OTP - ${otp}`,
    'withdraw': `Your NiveshBay Withdrawal Verification OTP - ${otp}`,
  };

  const subject = subjects[purpose] || `Your NiveshBay OTP - ${otp}`;
  const body = `Hi,\n\nYour OTP for NiveshBay is: ${otp}\n\nThis OTP is valid for 10 minutes only.\n\nDo not share this OTP with anyone.\n\nTeam NiveshBay`;

  return { subject, body };
}

function sendViaMailjet(email, otp, purpose) {
  const { subject, body } = getEmailTemplate(otp, purpose);

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      Messages: [{
        From: { Email: process.env.EMAIL_FROM || 'sg25042023@gmail.com', Name: 'NiveshBay' },
        To: [{ Email: email }],
        Subject: subject,
        TextPart: body,
      }]
    });

    const auth = Buffer.from(`${process.env.MAILJET_API_KEY}:${process.env.MAILJET_SECRET_KEY}`).toString('base64');

    const req = https.request({
      hostname: 'api.mailjet.com',
      path: '/v3.1/send',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let chunk = '';
      res.on('data', (c) => chunk += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(chunk));
          } catch (_) {
            resolve(chunk);
          }
        } else {
          reject(new Error(`Mailjet API ${res.statusCode}: ${chunk}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sendViaBrevo(email, otp, purpose) {
  const { subject, body } = getEmailTemplate(otp, purpose);

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      sender: { email: process.env.EMAIL_FROM || 'sg25042023@gmail.com', name: 'NiveshBay' },
      to: [{ email }],
      subject,
      textContent: body,
    });

    const req = https.request({
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let chunk = '';
      res.on('data', (c) => chunk += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(chunk));
          } catch (_) {
            resolve(chunk);
          }
        } else {
          reject(new Error(`Brevo API ${res.statusCode}: ${chunk}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sendViaSendGrid(email, otp, purpose) {
  const { subject, body } = getEmailTemplate(otp, purpose);

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: { email: process.env.EMAIL_FROM || 'sg25042023@gmail.com', name: 'NiveshBay' },
      subject,
      content: [{ type: 'text/plain', value: body }],
    });

    const req = https.request({
      hostname: 'api.sendgrid.com',
      path: '/v3/mail/send',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let chunk = '';
      res.on('data', (c) => chunk += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(chunk ? JSON.parse(chunk) : { success: true });
          } catch (_) {
            resolve(chunk);
          }
        } else {
          reject(new Error(`SendGrid API ${res.statusCode}: ${chunk}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sendViaResend(email, otp, purpose) {
  const { subject, body } = getEmailTemplate(otp, purpose);

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      from: process.env.RESEND_FROM || 'onboarding@resend.dev',
      to: [email],
      subject,
      text: body,
    });

    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let chunk = '';
      res.on('data', (c) => chunk += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(chunk));
          } catch (_) {
            resolve(chunk);
          }
        } else {
          reject(new Error(`Resend API ${res.statusCode}: ${chunk}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sendViaMailtrap(email, otp, purpose) {
  const { subject, body } = getEmailTemplate(otp, purpose);

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      from: { email: process.env.EMAIL_FROM || 'onboarding@mailtrap.dev', name: 'NiveshBay' },
      to: [{ email }],
      subject,
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
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(chunk));
          } catch (_) {
            resolve(chunk);
          }
        } else {
          reject(new Error(`Mailtrap API ${res.statusCode}: ${chunk}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function sendOtpEmail(email, otp, purpose) {
  if (process.env.MAILJET_API_KEY) {
    return sendViaMailjet(email, otp, purpose);
  }
  if (process.env.BREVO_API_KEY) {
    return sendViaBrevo(email, otp, purpose);
  }
  if (process.env.SENDGRID_API_KEY) {
    return sendViaSendGrid(email, otp, purpose);
  }
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(email, otp, purpose);
  }
  if (process.env.MAILTRAP_API_TOKEN) {
    return sendViaMailtrap(email, otp, purpose);
  }
  if (transporter) {
    const { subject, body } = getEmailTemplate(otp, purpose);
    await transporter.sendMail({
      from: `"NiveshBay" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      text: body,
    });
    return;
  }
  throw new Error('No email method configured. Set MAILJET_API_KEY, BREVO_API_KEY, SENDGRID_API_KEY, RESEND_API_KEY, MAILTRAP_API_TOKEN or EMAIL_HOST');
}

module.exports = { sendOtpEmail };
