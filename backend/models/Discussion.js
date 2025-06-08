// Discussion Model - Stores comments and discussions about elements
const mongoose = require('mongoose');

const discussionSchema = new mongoose.Schema({
  elementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Element',
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  comment: {
    type: String,
    required: true,
    maxlength: 2000
  },
  
  // Thread support for replies
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion',
    default: null
  },
  
  // Comment metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    edited: {
      type: Boolean,
      default: false
    },
    editedAt: Date
  },
  
  // Reactions/voting
  reactions: {
    likes: {
      type: Number,
      default: 0
    },
    dislikes: {
      type: Number,
      default: 0
    },
    hearts: {
      type: Number,
      default: 0
    }
  },
  
  // User reactions tracking
  userReactions: [{
    userId: String,
    type: {
      type: String,
      enum: ['like', 'dislike', 'heart']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Status and moderation
  status: {
    type: String,
    enum: ['active', 'hidden', 'deleted', 'flagged'],
    default: 'active'
  },
  
  // Tags for categorization
  tags: [{
    type: String,
    trim: true
  }],
  
  // Mentions (@username)
  mentions: [{
    userId: String,
    username: String
  }],
  
  // Attachments (screenshots, etc.)
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'file', 'link']
    },
    url: String,
    filename: String,
    size: Number,
    mimeType: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
discussionSchema.index({ elementId: 1, createdAt: -1 });
discussionSchema.index({ userId: 1, createdAt: -1 });
discussionSchema.index({ parentId: 1 });
discussionSchema.index({ status: 1 });

// Virtual for replies
discussionSchema.virtual('replies', {
  ref: 'Discussion',
  localField: '_id',
  foreignField: 'parentId'
});

// Virtual for reply count
discussionSchema.virtual('replyCount', {
  ref: 'Discussion',
  localField: '_id',
  foreignField: 'parentId',
  count: true
});

// Instance methods
discussionSchema.methods.addReaction = function(userId, reactionType) {
  // Remove existing reaction from this user
  this.userReactions = this.userReactions.filter(r => r.userId !== userId);
  
  // Add new reaction
  this.userReactions.push({
    userId,
    type: reactionType
  });
  
  // Update reaction counts
  this.reactions.likes = this.userReactions.filter(r => r.type === 'like').length;
  this.reactions.dislikes = this.userReactions.filter(r => r.type === 'dislike').length;
  this.reactions.hearts = this.userReactions.filter(r => r.type === 'heart').length;
  
  return this.save();
};

discussionSchema.methods.removeReaction = function(userId) {
  this.userReactions = this.userReactions.filter(r => r.userId !== userId);
  
  // Update reaction counts
  this.reactions.likes = this.userReactions.filter(r => r.type === 'like').length;
  this.reactions.dislikes = this.userReactions.filter(r => r.type === 'dislike').length;
  this.reactions.hearts = this.userReactions.filter(r => r.type === 'heart').length;
  
  return this.save();
};

discussionSchema.methods.editComment = function(newComment) {
  this.comment = newComment;
  this.metadata.edited = true;
  this.metadata.editedAt = new Date();
  return this.save();
};

// Static methods
discussionSchema.statics.findByElement = function(elementId, options = {}) {
  const query = { 
    elementId,
    status: 'active'
  };
  
  // Only top-level comments by default
  if (!options.includeReplies) {
    query.parentId = null;
  }
  
  return this.find(query)
    .sort({ createdAt: options.sortOrder === 'asc' ? 1 : -1 })
    .limit(options.limit || 50)
    .populate('replies');
};

discussionSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId, status: 'active' };
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 100)
    .populate('elementId', 'element.tag element.classes pageUrl');
};

discussionSchema.statics.getThreadStats = function(elementId) {
  return this.aggregate([
    { $match: { elementId: mongoose.Types.ObjectId(elementId), status: 'active' } },
    {
      $group: {
        _id: null,
        totalComments: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        lastActivity: { $max: '$createdAt' },
        totalReactions: { 
          $sum: { 
            $add: ['$reactions.likes', '$reactions.dislikes', '$reactions.hearts'] 
          } 
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalComments: 1,
        uniqueUserCount: { $size: '$uniqueUsers' },
        lastActivity: 1,
        totalReactions: 1
      }
    }
  ]);
};

// Pre-save middleware
discussionSchema.pre('save', function(next) {
  // Extract mentions from comment text
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(this.comment)) !== null) {
    mentions.push({
      username: match[1],
      userId: match[1] // In a real app, you'd look up the actual userId
    });
  }
  
  this.mentions = mentions;
  
  // Auto-tag based on content
  const autoTags = [];
  
  if (this.comment.toLowerCase().includes('bug')) {
    autoTags.push('bug');
  }
  if (this.comment.toLowerCase().includes('improvement')) {
    autoTags.push('improvement');
  }
  if (this.comment.toLowerCase().includes('accessibility')) {
    autoTags.push('accessibility');
  }
  if (this.comment.toLowerCase().includes('design')) {
    autoTags.push('design');
  }
  
  this.tags = [...new Set([...this.tags, ...autoTags])];
  
  next();
});

module.exports = mongoose.model('Discussion', discussionSchema); 