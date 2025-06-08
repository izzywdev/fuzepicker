// AiOutput Model - Stores AI-generated content and insights
const mongoose = require('mongoose');

const aiOutputSchema = new mongoose.Schema({
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
  task: {
    type: String,
    required: true,
    enum: ['discuss', 'figma', 'playwright', 'react'],
    index: true
  },
  
  // AI processing details
  prompt: {
    type: String,
    required: true
  },
  model: {
    name: String,
    version: String,
    provider: {
      type: String,
      enum: ['openai', 'anthropic', 'google', 'local'],
      default: 'openai'
    }
  },
  
  // Generated content
  output: {
    content: {
      type: String,
      required: true
    },
    format: {
      type: String,
      enum: ['markdown', 'json', 'code', 'html', 'text'],
      default: 'markdown'
    },
    language: {
      type: String, // For code outputs: 'typescript', 'javascript', 'json', etc.
      default: null
    }
  },
  
  // Structured data for specific task types
  structuredData: {
    // For Figma outputs
    figma: {
      components: mongoose.Schema.Types.Mixed,
      layers: mongoose.Schema.Types.Mixed,
      styles: mongoose.Schema.Types.Mixed
    },
    
    // For Playwright outputs
    playwright: {
      selectors: [String],
      actions: [String],
      assertions: [String],
      testFile: String
    },
    
    // For React outputs
    react: {
      componentName: String,
      props: mongoose.Schema.Types.Mixed,
      dependencies: [String],
      tailwindClasses: [String]
    },
    
    // For discussion/analysis outputs
    analysis: {
      accessibility: {
        score: Number,
        issues: [String],
        suggestions: [String]
      },
      performance: {
        score: Number,
        issues: [String],
        suggestions: [String]
      },
      design: {
        score: Number,
        issues: [String],
        suggestions: [String]
      }
    }
  },
  
  // Processing metadata
  processing: {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    startedAt: Date,
    completedAt: Date,
    duration: Number, // in milliseconds
    tokensUsed: {
      input: Number,
      output: Number,
      total: Number
    },
    cost: Number, // API cost in cents
    error: {
      message: String,
      code: String,
      stack: String
    }
  },
  
  // Quality and feedback
  quality: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    useful: {
      type: Boolean,
      default: null
    },
    userReactions: [{
      userId: String,
      reaction: {
        type: String,
        enum: ['like', 'dislike', 'love', 'useful', 'not-useful']
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // Versioning for iterative improvements
  version: {
    type: Number,
    default: 1
  },
  parentOutputId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AiOutput',
    default: null
  },
  
  // Tags and categorization
  tags: [{
    type: String,
    trim: true
  }],
  
  // Privacy and sharing
  isPublic: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    userId: String,
    permission: {
      type: String,
      enum: ['view', 'edit', 'admin'],
      default: 'view'
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
aiOutputSchema.index({ elementId: 1, task: 1 });
aiOutputSchema.index({ userId: 1, createdAt: -1 });
aiOutputSchema.index({ task: 1, 'processing.status': 1 });
aiOutputSchema.index({ 'quality.rating': 1 });
aiOutputSchema.index({ tags: 1 });

// Virtual for child outputs (iterations)
aiOutputSchema.virtual('childOutputs', {
  ref: 'AiOutput',
  localField: '_id',
  foreignField: 'parentOutputId'
});

// Instance methods
aiOutputSchema.methods.markAsCompleted = function(output, structuredData = {}) {
  this.output.content = output;
  this.structuredData = { ...this.structuredData, ...structuredData };
  this.processing.status = 'completed';
  this.processing.completedAt = new Date();
  
  if (this.processing.startedAt) {
    this.processing.duration = this.processing.completedAt - this.processing.startedAt;
  }
  
  return this.save();
};

aiOutputSchema.methods.markAsFailed = function(error) {
  this.processing.status = 'failed';
  this.processing.completedAt = new Date();
  this.processing.error = {
    message: error.message,
    code: error.code || 'UNKNOWN',
    stack: error.stack
  };
  
  return this.save();
};

aiOutputSchema.methods.addReaction = function(userId, reaction) {
  // Remove existing reaction from this user
  this.quality.userReactions = this.quality.userReactions.filter(r => r.userId !== userId);
  
  // Add new reaction
  this.quality.userReactions.push({
    userId,
    reaction
  });
  
  return this.save();
};

aiOutputSchema.methods.createIteration = function(newPrompt) {
  const AiOutput = this.constructor;
  
  return new AiOutput({
    elementId: this.elementId,
    userId: this.userId,
    task: this.task,
    prompt: newPrompt,
    model: this.model,
    version: this.version + 1,
    parentOutputId: this._id,
    tags: this.tags
  });
};

// Static methods
aiOutputSchema.statics.findByElement = function(elementId, options = {}) {
  const query = { elementId };
  
  if (options.task) {
    query.task = options.task;
  }
  
  if (options.status) {
    query['processing.status'] = options.status;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 20)
    .populate('childOutputs');
};

aiOutputSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId };
  
  if (options.task) {
    query.task = options.task;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .populate('elementId', 'element.tag element.classes pageUrl');
};

aiOutputSchema.statics.getTaskStats = function(userId = null) {
  const matchQuery = userId ? { userId } : {};
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$task',
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$processing.status', 'completed'] }, 1, 0] }
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$processing.status', 'failed'] }, 1, 0] }
        },
        avgRating: { $avg: '$quality.rating' },
        totalTokens: { $sum: '$processing.tokensUsed.total' },
        totalCost: { $sum: '$processing.cost' }
      }
    }
  ]);
};

aiOutputSchema.statics.findHighQuality = function(task = null, minRating = 4) {
  const query = {
    'processing.status': 'completed',
    'quality.rating': { $gte: minRating },
    isPublic: true
  };
  
  if (task) {
    query.task = task;
  }
  
  return this.find(query)
    .sort({ 'quality.rating': -1, createdAt: -1 })
    .limit(20)
    .populate('elementId', 'element.tag element.classes');
};

// Pre-save middleware
aiOutputSchema.pre('save', function(next) {
  // Auto-generate tags based on task and content
  const autoTags = [this.task];
  
  if (this.task === 'react' && this.structuredData.react?.componentName) {
    autoTags.push('component');
  }
  
  if (this.task === 'figma') {
    autoTags.push('design', 'ui');
  }
  
  if (this.task === 'playwright') {
    autoTags.push('testing', 'automation');
  }
  
  if (this.task === 'discuss') {
    autoTags.push('analysis', 'feedback');
  }
  
  // Merge with existing tags
  this.tags = [...new Set([...this.tags, ...autoTags])];
  
  // Set processing timestamps
  if (this.processing.status === 'processing' && !this.processing.startedAt) {
    this.processing.startedAt = new Date();
  }
  
  next();
});

module.exports = mongoose.model('AiOutput', aiOutputSchema); 