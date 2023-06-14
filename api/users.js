const express = require('express');
const jwtMiddleware = require('../jwtMiddleware');
const router = express.Router();
const userSchema = require('../models/user');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

exports.router = router;

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many requests from this IP, please try again in a minute'
});

router.post('/', limiter, (req, res) => {
  if (req.userSchema.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const userData = req.body;
  const newUser = new userSchema(userData);
  newUser.save().then(() => {
    res.status(201).json({ id: newUser.userid});
  }).catch(err => {
    console.error(err);
    res.status(500).json({
      error: 'Error creating user'
    });
  });
});

router.post('/login', limiter, async (req, res) => {
  const { email, password } = req.body;
  try{
    const user = await userSchema.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRATION_TIME });
    res.status(200).json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error logging in' });
  }
});

router.get('/:userId', limiter, jwtMiddleware, async (req, res) => {
  try {
    const user = await userSchema.findOne({ userid: req.params.userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (req.userSchema.role !== 'admin' && req.userSchema.userid !== user.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    let classes = [];
    if (user.role === 'student') {
      classes = await userSchema.aggregate([
        { $match: { userid: user.userid } },
        { $lookup: { from: 'courses', localField: 'userId', foreignField: 'instructor', as: 'teachingClasses'}},
        { $project: { _id: 0, teachingClasses: 1 } }
      ]);
    }
    const userData = {
      id: user.userid,
      name: user.name,
      email: user.email,
      role: user.role,
      classes
    };

    res.status(200).json(userData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error getting user' });
  }
});