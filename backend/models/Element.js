// Element Model - Stores DOM element data
const mongoose = require('mongoose');

const elementSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  pageUrl: {
    type: String,
    required: true
  },
  element: {
    // Basic element info
    tag: {
      type: String,
      required: true
    },
    id: {
      type: String,
      default: null
    },
    classes: [{
      type: String
    }],
    text: {
      type: String,
      default: ''
    },
    html: {
      type: String,
      required: true
    },
    
    // CSS Styles
    styles: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    
    // Element attributes
    attributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    
    // Position and dimensions
    boundingBox: {
      x: Number,
      y: Number,
      width: Number,
      height: Number,
      top: Number,
      left: Number,
      bottom: Number,
      right: Number
    },
    
    // Selectors for element identification
    xpath: {
      type: String,
      required: true
    },
    selector: {
      type: String,
      required: true
    }
  },
  
  // Metadata
  metadata: {
    userAgent: String,
    screenResolution: String,
    viewport: {
      width: Number,
      height: Number
    },
    capturedAt: {
      type: Date,
      default: Date.now
    }
  },
  
  // Tags for organization
  tags: [{
    type: String,
    trim: true
  }],
  
  // Privacy settings
  isPublic: {
    type: Boolean,
    default: false
  },
  
  // Related elements (for component grouping)
  relatedElements: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Element'
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
elementSchema.index({ userId: 1, createdAt: -1 });
elementSchema.index({ pageUrl: 1 });
elementSchema.index({ 'element.tag': 1 });
elementSchema.index({ 'element.classes': 1 });
elementSchema.index({ tags: 1 });

// Virtual for discussions
elementSchema.virtual('discussions', {
  ref: 'Discussion',
  localField: '_id',
  foreignField: 'elementId'
});

// Virtual for AI outputs
elementSchema.virtual('aiOutputs', {
  ref: 'AiOutput',
  localField: '_id',
  foreignField: 'elementId'
});

// Instance methods
elementSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  if (!this.isPublic && obj.userId !== this.currentUserId) {
    delete obj.element.html;
    delete obj.metadata;
  }
  return obj;
};

// Static methods
elementSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId };
  
  if (options.pageUrl) {
    query.pageUrl = options.pageUrl;
  }
  
  if (options.tags && options.tags.length > 0) {
    query.tags = { $in: options.tags };
  }
  
  if (options.elementType) {
    query['element.tag'] = options.elementType;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .populate('discussions aiOutputs');
};

elementSchema.statics.findSimilar = function(element, userId) {
  const query = {
    userId,
    'element.tag': element.tag,
    _id: { $ne: element._id }
  };
  
  // Add class-based similarity
  if (element.classes && element.classes.length > 0) {
    query['element.classes'] = { $in: element.classes };
  }
  
  return this.find(query)
    .limit(10)
    .sort({ createdAt: -1 });
};

// Pre-save middleware
elementSchema.pre('save', function(next) {
  // Ensure tags are unique and trimmed
  if (this.tags) {
    this.tags = [...new Set(this.tags.map(tag => tag.trim().toLowerCase()))];
  }
  
  // Auto-generate tags based on element properties
  const autoTags = [];
  
  if (this.element.tag) {
    autoTags.push(this.element.tag);
  }
  
  if (this.element.classes && this.element.classes.length > 0) {
    autoTags.push(...this.element.classes);
  }
  
  if (this.element.attributes && this.element.attributes.role) {
    autoTags.push(`role-${this.element.attributes.role}`);
  }
  
  // Merge with existing tags
  this.tags = [...new Set([...this.tags, ...autoTags])];
  
  next();
});

module.exports = mongoose.model('Element', elementSchema); 