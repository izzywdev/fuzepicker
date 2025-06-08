// Elements API Routes
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Element = require('../models/Element');
const Discussion = require('../models/Discussion');
const AiOutput = require('../models/AiOutput');

// Validation schemas
const elementSchema = Joi.object({
  userId: Joi.string().required(),
  pageUrl: Joi.string().uri().required(),
  element: Joi.object({
    tag: Joi.string().required(),
    id: Joi.string().allow(null),
    classes: Joi.array().items(Joi.string()),
    text: Joi.string().allow(''),
    html: Joi.string().required(),
    styles: Joi.object(),
    attributes: Joi.object(),
    boundingBox: Joi.object({
      x: Joi.number(),
      y: Joi.number(),
      width: Joi.number(),
      height: Joi.number(),
      top: Joi.number(),
      left: Joi.number(),
      bottom: Joi.number(),
      right: Joi.number()
    }),
    xpath: Joi.string().required(),
    selector: Joi.string().required()
  }).required(),
  tags: Joi.array().items(Joi.string()),
  metadata: Joi.object({
    userAgent: Joi.string(),
    screenResolution: Joi.string(),
    viewport: Joi.object({
      width: Joi.number(),
      height: Joi.number()
    })
  })
});

const querySchema = Joi.object({
  userId: Joi.string(),
  pageUrl: Joi.string().uri(),
  tags: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string())
  ),
  elementType: Joi.string(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  page: Joi.number().integer().min(1).default(1)
});

// POST /api/elements - Store a new element
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = elementSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => d.message)
      });
    }

    // Check for duplicate elements (same selector on same page by same user)
    const existing = await Element.findOne({
      userId: value.userId,
      pageUrl: value.pageUrl,
      'element.selector': value.element.selector
    });

    if (existing) {
      // Update existing element instead of creating duplicate
      Object.assign(existing, value);
      existing.metadata.capturedAt = new Date();
      await existing.save();
      
      return res.status(200).json({
        message: 'Element updated',
        element: existing,
        duplicate: true
      });
    }

    // Create new element
    const element = new Element(value);
    await element.save();

    res.status(201).json({
      message: 'Element stored successfully',
      element: element
    });

  } catch (error) {
    console.error('Error storing element:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to store element'
    });
  }
});

// GET /api/elements - Retrieve elements with filtering
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

    const { userId, pageUrl, tags, elementType, limit, page } = value;
    
    // Build query
    const query = {};
    
    if (userId) {
      query.userId = userId;
    }
    
    if (pageUrl) {
      query.pageUrl = pageUrl;
    }
    
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query.tags = { $in: tagArray };
    }
    
    if (elementType) {
      query['element.tag'] = elementType;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const elements = await Element.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('discussions', 'comment userId createdAt')
      .populate('aiOutputs', 'task output.content processing.status createdAt');

    // Get total count for pagination
    const total = await Element.countDocuments(query);

    res.json({
      elements,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error retrieving elements:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve elements'
    });
  }
});

// GET /api/elements/:id - Get specific element by ID
router.get('/:id', async (req, res) => {
  try {
    const element = await Element.findById(req.params.id)
      .populate('discussions')
      .populate('aiOutputs');

    if (!element) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Element not found'
      });
    }

    res.json({ element });

  } catch (error) {
    console.error('Error retrieving element:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve element'
    });
  }
});

// PUT /api/elements/:id - Update element
router.put('/:id', async (req, res) => {
  try {
    const element = await Element.findById(req.params.id);
    
    if (!element) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Element not found'
      });
    }

    // Validate partial update
    const updateSchema = elementSchema.fork(['userId', 'pageUrl', 'element'], schema => schema.optional());
    const { error, value } = updateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => d.message)
      });
    }

    // Update element
    Object.assign(element, value);
    await element.save();

    res.json({
      message: 'Element updated successfully',
      element
    });

  } catch (error) {
    console.error('Error updating element:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update element'
    });
  }
});

// DELETE /api/elements/:id - Delete element
router.delete('/:id', async (req, res) => {
  try {
    const element = await Element.findById(req.params.id);
    
    if (!element) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Element not found'
      });
    }

    // Also delete related discussions and AI outputs
    await Discussion.deleteMany({ elementId: element._id });
    await AiOutput.deleteMany({ elementId: element._id });
    
    await Element.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Element deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting element:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete element'
    });
  }
});

// GET /api/elements/:id/similar - Find similar elements
router.get('/:id/similar', async (req, res) => {
  try {
    const element = await Element.findById(req.params.id);
    
    if (!element) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Element not found'
      });
    }

    const similarElements = await Element.findSimilar(element.element, element.userId);

    res.json({ 
      similar: similarElements,
      count: similarElements.length
    });

  } catch (error) {
    console.error('Error finding similar elements:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to find similar elements'
    });
  }
});

// GET /api/elements/stats/overview - Get user statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId parameter is required'
      });
    }

    const stats = await Element.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalElements: { $sum: 1 },
          uniquePages: { $addToSet: '$pageUrl' },
          elementTypes: { $addToSet: '$element.tag' },
          lastActivity: { $max: '$createdAt' }
        }
      },
      {
        $project: {
          _id: 0,
          totalElements: 1,
          uniquePageCount: { $size: '$uniquePages' },
          elementTypeCount: { $size: '$elementTypes' },
          elementTypes: 1,
          lastActivity: 1
        }
      }
    ]);

    // Get discussion and AI output counts
    const discussionCount = await Discussion.countDocuments({ userId });
    const aiOutputCount = await AiOutput.countDocuments({ userId });

    const overview = stats[0] || {
      totalElements: 0,
      uniquePageCount: 0,
      elementTypeCount: 0,
      elementTypes: [],
      lastActivity: null
    };

    overview.discussionCount = discussionCount;
    overview.aiOutputCount = aiOutputCount;

    res.json({ stats: overview });

  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get statistics'
    });
  }
});

module.exports = router; 