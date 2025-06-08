// Discussions API Routes
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Discussion = require('../models/Discussion');
const Element = require('../models/Element');

// Validation schemas
const discussionSchema = Joi.object({
  elementId: Joi.string().required(),
  userId: Joi.string().required(),
  comment: Joi.string().max(2000).required(),
  parentId: Joi.string().allow(null),
  tags: Joi.array().items(Joi.string()),
  metadata: Joi.object({
    userAgent: Joi.string(),
    ipAddress: Joi.string()
  })
});

const reactionSchema = Joi.object({
  userId: Joi.string().required(),
  type: Joi.string().valid('like', 'dislike', 'heart').required()
});

const querySchema = Joi.object({
  elementId: Joi.string(),
  userId: Joi.string(),
  includeReplies: Joi.boolean().default(false),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  limit: Joi.number().integer().min(1).max(100).default(50),
  page: Joi.number().integer().min(1).default(1)
});

// POST /api/discussions - Add a new comment
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = discussionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => d.message)
      });
    }

    // Verify element exists
    const element = await Element.findById(value.elementId);
    if (!element) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Element not found'
      });
    }

    // If parentId provided, verify parent comment exists
    if (value.parentId) {
      const parentComment = await Discussion.findById(value.parentId);
      if (!parentComment) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Parent comment not found'
        });
      }
    }

    // Create discussion
    const discussion = new Discussion(value);
    await discussion.save();

    // Populate and return
    await discussion.populate('replies');

    res.status(201).json({
      message: 'Comment added successfully',
      discussion
    });

  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to add comment'
    });
  }
});

// GET /api/discussions - Get discussions with filtering
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

    const { elementId, userId, includeReplies, sortOrder, limit, page } = value;
    
    // Build query
    const query = { status: 'active' };
    
    if (elementId) {
      query.elementId = elementId;
    }
    
    if (userId) {
      query.userId = userId;
    }
    
    // Only top-level comments by default
    if (!includeReplies) {
      query.parentId = null;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const discussions = await Discussion.find(query)
      .sort({ createdAt: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .populate('replies')
      .populate('elementId', 'element.tag element.classes pageUrl');

    // Get total count for pagination
    const total = await Discussion.countDocuments(query);

    res.json({
      discussions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error retrieving discussions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve discussions'
    });
  }
});

// GET /api/discussions/:id - Get specific discussion by ID
router.get('/:id', async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id)
      .populate('replies')
      .populate('elementId', 'element.tag element.classes pageUrl');

    if (!discussion) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Discussion not found'
      });
    }

    res.json({ discussion });

  } catch (error) {
    console.error('Error retrieving discussion:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve discussion'
    });
  }
});

// PUT /api/discussions/:id - Update discussion (edit comment)
router.put('/:id', async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);
    
    if (!discussion) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Discussion not found'
      });
    }

    // Validate update
    const updateSchema = Joi.object({
      comment: Joi.string().max(2000).required(),
      userId: Joi.string().required()
    });

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => d.message)
      });
    }

    // Check if user is authorized to edit
    if (discussion.userId !== value.userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only edit your own comments'
      });
    }

    // Update comment
    await discussion.editComment(value.comment);

    res.json({
      message: 'Comment updated successfully',
      discussion
    });

  } catch (error) {
    console.error('Error updating discussion:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update discussion'
    });
  }
});

// DELETE /api/discussions/:id - Delete discussion
router.delete('/:id', async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);
    
    if (!discussion) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Discussion not found'
      });
    }

    // Check authorization (basic check - in real app would be more sophisticated)
    const { userId } = req.body;
    if (discussion.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only delete your own comments'
      });
    }

    // Soft delete - mark as deleted instead of removing
    discussion.status = 'deleted';
    await discussion.save();

    res.json({
      message: 'Comment deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting discussion:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete discussion'
    });
  }
});

// POST /api/discussions/:id/reactions - Add or update reaction
router.post('/:id/reactions', async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);
    
    if (!discussion) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Discussion not found'
      });
    }

    // Validate reaction
    const { error, value } = reactionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => d.message)
      });
    }

    // Add reaction
    await discussion.addReaction(value.userId, value.type);

    res.json({
      message: 'Reaction added successfully',
      reactions: discussion.reactions
    });

  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to add reaction'
    });
  }
});

// DELETE /api/discussions/:id/reactions - Remove reaction
router.delete('/:id/reactions', async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);
    
    if (!discussion) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Discussion not found'
      });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId is required'
      });
    }

    // Remove reaction
    await discussion.removeReaction(userId);

    res.json({
      message: 'Reaction removed successfully',
      reactions: discussion.reactions
    });

  } catch (error) {
    console.error('Error removing reaction:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to remove reaction'
    });
  }
});

// GET /api/discussions/element/:elementId - Get all discussions for an element
router.get('/element/:elementId', async (req, res) => {
  try {
    const { elementId } = req.params;
    const { includeReplies = false, sortOrder = 'desc' } = req.query;

    const discussions = await Discussion.findByElement(elementId, {
      includeReplies: includeReplies === 'true',
      sortOrder
    });

    // Get thread stats
    const stats = await Discussion.getThreadStats(elementId);

    res.json({
      discussions,
      stats: stats[0] || {
        totalComments: 0,
        uniqueUserCount: 0,
        lastActivity: null,
        totalReactions: 0
      }
    });

  } catch (error) {
    console.error('Error retrieving element discussions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve discussions'
    });
  }
});

// GET /api/discussions/user/:userId - Get all discussions by a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const discussions = await Discussion.findByUser(userId, { limit: parseInt(limit) });

    res.json({ discussions });

  } catch (error) {
    console.error('Error retrieving user discussions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve user discussions'
    });
  }
});

// GET /api/discussions/stats/overview - Get discussion statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const { userId, elementId } = req.query;
    
    const matchQuery = {};
    if (userId) matchQuery.userId = userId;
    if (elementId) matchQuery.elementId = elementId;

    const stats = await Discussion.aggregate([
      { $match: { ...matchQuery, status: 'active' } },
      {
        $group: {
          _id: null,
          totalComments: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          uniqueElements: { $addToSet: '$elementId' },
          totalReactions: { 
            $sum: { 
              $add: ['$reactions.likes', '$reactions.dislikes', '$reactions.hearts'] 
            } 
          },
          lastActivity: { $max: '$createdAt' },
          avgCommentLength: { $avg: { $strLenCP: '$comment' } }
        }
      },
      {
        $project: {
          _id: 0,
          totalComments: 1,
          uniqueUserCount: { $size: '$uniqueUsers' },
          uniqueElementCount: { $size: '$uniqueElements' },
          totalReactions: 1,
          lastActivity: 1,
          avgCommentLength: { $round: ['$avgCommentLength', 0] }
        }
      }
    ]);

    res.json({ 
      stats: stats[0] || {
        totalComments: 0,
        uniqueUserCount: 0,
        uniqueElementCount: 0,
        totalReactions: 0,
        lastActivity: null,
        avgCommentLength: 0
      }
    });

  } catch (error) {
    console.error('Error getting discussion stats:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get statistics'
    });
  }
});

module.exports = router; 