const Joi = require('joi');
exports.validate = (data) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(100).required(),
        email: Joi.string().min(3).max(255).email().required(),
        password: Joi.string().min(8).max(255).required(),
        phone: Joi.string().pattern(/^\d{10}$/).required().messages({
            'string.pattern.base': 'Phone number must be exactly 10 digits.'
        }),
        referral_id: Joi.string().alphanum().length(6).optional().allow('')
    });
    return schema.validate(data);
}


exports.authValidate = (data) => {
    const schema = Joi.object({
        email: Joi.string().min(3).max(255).email().required(),
        password: Joi.string().min(3).max(255).required()
    })
    return schema.validate(data);
}