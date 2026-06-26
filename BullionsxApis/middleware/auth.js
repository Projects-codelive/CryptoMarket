const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config', '.env') });
const jwt = require('jsonwebtoken');
module.exports = function (req, res, next) {

    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ 'message': "Access denied.No token provided" });
    try {
        const decoded = jwt.verify(token, process.env.Private_key);
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(400).json({ 'message': 'invalid token' });
    }
}