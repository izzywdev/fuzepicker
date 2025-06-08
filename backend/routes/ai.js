// AI Processing API Routes
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const AiOutput = require('../models/AiOutput');
const Element = require('../models/Element');
const aiService = require('../services/aiService');

// Validation schemas
const aiTaskSchema = Joi.object({
  elementId: Joi.string(),
  userId: Joi.string().required(),
  task: Joi.string().valid('discuss', 'figma', 'playwright', 'react').required(),
  element: Joi.object().required(),
  pageUrl: Joi.string().uri().required(),
  prompt: Joi.string(),
  model: Joi.object({
    name: Joi.string(),
    version: Joi.string(),
    provider: Joi.string().valid('openai', 'anthropic', 'google', 'local')
  }),
  options: Joi.object({
    temperature: Joi.number().min(0).max(2),
    maxTokens: Joi.number().min(1).max(8000),
    stream: Joi.boolean().default(false)
  })
});

const querySchema = Joi.object({
  elementId: Joi.string(),
  userId: Joi.string(),
  task: Joi.string().valid('discuss', 'figma', 'playwright', 'react'),
  status: Joi.string().valid('pending', 'processing', 'completed', 'failed'),
  limit: Joi.number().integer().min(1).max(100).default(20),
  page: Joi.number().integer().min(1).default(1)
});

// POST /api/ai-task - Process AI task
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = aiTaskSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => d.message)
      });
    }

    const { elementId, userId, task, element, pageUrl, prompt, model, options } = value;

    // If elementId provided, verify element exists
    let elementDoc = null;
    if (elementId) {
      elementDoc = await Element.findById(elementId);
      if (!elementDoc) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Element not found'
        });
      }
    }

    // Generate or use provided prompt
    const finalPrompt = prompt || aiService.generatePrompt(task, element, pageUrl);

    // Create AI output record
    const aiOutput = new AiOutput({
      elementId: elementDoc?._id,
      userId,
      task,
      prompt: finalPrompt,
      model: model || { provider: 'openai', name: 'gpt-4', version: '1.0' },
      output: {
        content: '',
        format: getOutputFormat(task),
        language: getOutputLanguage(task)
      },
      processing: {
        status: 'pending'
      }
    });

    await aiOutput.save();

    // Start AI processing asynchronously
    processAiTaskAsync(aiOutput._id, task, element, pageUrl, finalPrompt, options);

    res.status(202).json({
      message: 'AI task queued for processing',
      taskId: aiOutput._id,
      status: 'pending'
    });

  } catch (error) {
    console.error('Error starting AI task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to start AI task'
    });
  }
});

// GET /api/ai-task/:id - Get AI task result
router.get('/:id', async (req, res) => {
  try {
    const aiOutput = await AiOutput.findById(req.params.id)
      .populate('elementId', 'element.tag element.classes pageUrl')
      .populate('childOutputs');

    if (!aiOutput) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'AI task not found'
      });
    }

    res.json({ aiOutput });

  } catch (error) {
    console.error('Error retrieving AI task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve AI task'
    });
  }
});

// GET /api/ai-task - Get AI tasks with filtering
router.get('/', async (req, res) => {
  try {
    // Validate query parameters
    const { error, value } = querySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => d.message)
      });
    }

    const { elementId, userId, task, status, limit, page } = value;
    
    // Build query
    const query = {};
    
    if (elementId) {
      query.elementId = elementId;
    }
    
    if (userId) {
      query.userId = userId;
    }
    
    if (task) {
      query.task = task;
    }
    
    if (status) {
      query['processing.status'] = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const aiOutputs = await AiOutput.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('elementId', 'element.tag element.classes pageUrl');

    // Get total count for pagination
    const total = await AiOutput.countDocuments(query);

    res.json({
      aiOutputs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error retrieving AI tasks:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve AI tasks'
    });
  }
});

// POST /api/ai-task/:id/iterate - Create iteration of existing task
router.post('/:id/iterate', async (req, res) => {
  try {
    const originalOutput = await AiOutput.findById(req.params.id);
    
    if (!originalOutput) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Original AI task not found'
      });
    }

    const { prompt, userId } = req.body;
    
    if (!prompt || !userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'prompt and userId are required'
      });
    }

    // Create new iteration
    const iteration = originalOutput.createIteration(prompt);
    await iteration.save();

    // Get element data for processing
    const element = await Element.findById(originalOutput.elementId);
    
    // Start processing
    processAiTaskAsync(iteration._id, iteration.task, element?.element, element?.pageUrl, prompt);

    res.status(202).json({
      message: 'AI task iteration queued for processing',
      taskId: iteration._id,
      status: 'pending'
    });

  } catch (error) {
    console.error('Error creating AI task iteration:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create iteration'
    });
  }
});

// POST /api/ai-task/:id/feedback - Add feedback to AI output
router.post('/:id/feedback', async (req, res) => {
  try {
    const aiOutput = await AiOutput.findById(req.params.id);
    
    if (!aiOutput) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'AI task not found'
      });
    }

    const feedbackSchema = Joi.object({
      userId: Joi.string().required(),
      rating: Joi.number().integer().min(1).max(5),
      feedback: Joi.string().max(1000),
      useful: Joi.boolean(),
      reaction: Joi.string().valid('like', 'dislike', 'love', 'useful', 'not-useful')
    });

    const { error, value } = feedbackSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => d.message)
      });
    }

    // Update quality metrics
    if (value.rating) {
      aiOutput.quality.rating = value.rating;
    }
    
    if (value.feedback) {
      aiOutput.quality.feedback = value.feedback;
    }
    
    if (typeof value.useful === 'boolean') {
      aiOutput.quality.useful = value.useful;
    }
    
    if (value.reaction) {
      await aiOutput.addReaction(value.userId, value.reaction);
    } else {
      await aiOutput.save();
    }

    res.json({
      message: 'Feedback added successfully',
      quality: aiOutput.quality
    });

  } catch (error) {
    console.error('Error adding feedback:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to add feedback'
    });
  }
});

// GET /api/ai-task/stats/overview - Get AI task statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const { userId } = req.query;
    
    const stats = await AiOutput.getTaskStats(userId);

    // Get additional metrics
    const totalOutputs = await AiOutput.countDocuments(userId ? { userId } : {});
    const recentOutputs = await AiOutput.countDocuments({
      ...(userId ? { userId } : {}),
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });

    res.json({
      taskStats: stats,
      overview: {
        totalOutputs,
        recentOutputs,
        avgProcessingTime: await getAvgProcessingTime(userId)
      }
    });

  } catch (error) {
    console.error('Error getting AI stats:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get statistics'
    });
  }
});

// GET /api/ai-task/high-quality - Get high-quality outputs for inspiration
router.get('/high-quality', async (req, res) => {
  try {
    const { task, minRating = 4 } = req.query;
    
    const highQualityOutputs = await AiOutput.findHighQuality(task, parseInt(minRating));

    res.json({ outputs: highQualityOutputs });

  } catch (error) {
    console.error('Error retrieving high-quality outputs:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve high-quality outputs'
    });
  }
});

// Helper functions
function getOutputFormat(task) {
  const formats = {
    discuss: 'markdown',
    figma: 'json',
    playwright: 'code',
    react: 'code'
  };
  return formats[task] || 'text';
}

function getOutputLanguage(task) {
  const languages = {
    discuss: null,
    figma: 'json',
    playwright: 'typescript',
    react: 'tsx'
  };
  return languages[task] || null;
}

async function processAiTaskAsync(taskId, task, element, pageUrl, prompt, options = {}) {
  try {
    // Update status to processing
    const aiOutput = await AiOutput.findById(taskId);
    aiOutput.processing.status = 'processing';
    aiOutput.processing.startedAt = new Date();
    await aiOutput.save();

    // Process with AI service
    const result = await aiService.processTask(task, element, pageUrl, prompt, options);

    // Mark as completed
    await aiOutput.markAsCompleted(result.content, result.structuredData);

  } catch (error) {
    console.error('AI processing error:', error);
    
    // Mark as failed
    const aiOutput = await AiOutput.findById(taskId);
    if (aiOutput) {
      await aiOutput.markAsFailed(error);
    }
  }
}

async function getAvgProcessingTime(userId = null) {
  try {
    const matchQuery = {
      'processing.status': 'completed',
      'processing.duration': { $exists: true, $ne: null }
    };
    
    if (userId) {
      matchQuery.userId = userId;
    }

    const result = await AiOutput.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$processing.duration' }
        }
      }
    ]);

    return result[0]?.avgDuration || 0;
  } catch (error) {
    console.error('Error calculating avg processing time:', error);
    return 0;
  }
}

module.exports = router; 