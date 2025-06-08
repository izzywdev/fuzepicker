// Authentication Routes
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { authMiddleware } = require('../middleware/auth');

// In-memory user store (in production, use a proper database)
const users = new Map();

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().min(2).max(50).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// POST /api/auth/register - Register new user
router.post('/register', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => d.message)
      });
    }

    const { username, email, password, name } = value;

    // Check if user already exists
    const existingUser = Array.from(users.values()).find(
      user => user.email === email || user.username === username
    );

    if (existingUser) {
      return res.status(409).json({
        error: 'User Already Exists',
        message: 'Email or username already registered'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const userId = Date.now().toString();
    const user = {
      id: userId,
      username,
      email,
      name,
      password: hashedPassword,
      role: 'user',
      createdAt: new Date(),
      lastLogin: null
    };

    users.set(userId, user);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: userId, 
        email, 
        username,
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: userId,
        username,
        email,
        name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to register user'
    });
  }
});

// POST /api/auth/login - User login
router.post('/login', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => d.message)
      });
    }

    const { email, password } = value;

    // Find user by email
    const user = Array.from(users.values()).find(user => user.email === email);
    
    if (!user) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to login'
    });
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = users.get(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'User account no longer exists'
      });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user info'
    });
  }
});

// POST /api/auth/refresh - Refresh JWT token
router.post('/refresh', authMiddleware, (req, res) => {
  try {
    const user = users.get(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'User account no longer exists'
      });
    }

    // Generate new token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Token refreshed successfully',
      token
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to refresh token'
    });
  }
});

// PUT /api/auth/profile - Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const updateSchema = Joi.object({
      name: Joi.string().min(2).max(50),
      email: Joi.string().email(),
      currentPassword: Joi.string().when('newPassword', {
        is: Joi.exist(),
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      newPassword: Joi.string().min(6)
    });

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => d.message)
      });
    }

    const user = users.get(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'User account no longer exists'
      });
    }

    // Update basic info
    if (value.name) {
      user.name = value.name;
    }

    if (value.email) {
      // Check if email is already taken
      const existingUser = Array.from(users.values()).find(
        u => u.email === value.email && u.id !== user.id
      );
      
      if (existingUser) {
        return res.status(409).json({
          error: 'Email Already Taken',
          message: 'Email is already registered'
        });
      }
      
      user.email = value.email;
    }

    // Update password if provided
    if (value.newPassword && value.currentPassword) {
      const isValidPassword = await bcrypt.compare(value.currentPassword, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Authentication Failed',
          message: 'Current password is incorrect'
        });
      }

      const saltRounds = 10;
      user.password = await bcrypt.hash(value.newPassword, saltRounds);
    }

    user.updatedAt = new Date();
    users.set(user.id, user);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update profile'
    });
  }
});

// POST /api/auth/logout - Logout user (client-side token removal)
router.post('/logout', authMiddleware, (req, res) => {
  // In a real implementation, you might maintain a blacklist of tokens
  // For now, we'll just return success as the client will remove the token
  res.json({
    message: 'Logout successful'
  });
});

// POST /api/auth/demo - Create demo user for testing
router.post('/demo', (req, res) => {
  try {
    // Create a demo user for testing purposes
    const demoUserId = 'demo_user_' + Date.now();
    const demoUser = {
      id: demoUserId,
      username: 'demo_user',
      email: 'demo@fuzepicker.com',
      name: 'Demo User',
      password: '', // No password for demo
      role: 'user',
      createdAt: new Date(),
      lastLogin: new Date()
    };

    users.set(demoUserId, demoUser);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: demoUserId, 
        email: demoUser.email, 
        username: demoUser.username,
        role: demoUser.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' } // Shorter expiry for demo
    );

    res.json({
      message: 'Demo user created',
      token,
      user: {
        id: demoUserId,
        username: demoUser.username,
        email: demoUser.email,
        name: demoUser.name,
        role: demoUser.role
      }
    });

  } catch (error) {
    console.error('Demo user creation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create demo user'
    });
  }
});

module.exports = router; 