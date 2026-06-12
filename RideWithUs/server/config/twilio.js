const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

const client = twilio(accountSid, authToken);


const sendOTP = async (phone) => {
  const verification = await client.verify.v2
    .services(serviceSid)
    .verifications.create({ to: phone, channel: 'sms' });
  return verification.sid;
};


const verifyOTP = async (phone, code) => {
  const result = await client.verify.v2
    .services(serviceSid)
    .verificationChecks.create({ to: phone, code });
  return result.status === 'approved';
};

module.exports = { sendOTP, verifyOTP };
