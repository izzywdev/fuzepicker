// AI Service - Handles AI processing and prompt generation
const { OpenAI } = require('openai');

class AiService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  generatePrompt(task, element, pageUrl) {
    const baseInfo = this.getElementInfo(element);
    const templates = this.getPromptTemplates();
    
    return templates[task] ? templates[task](baseInfo, pageUrl) : templates.default(baseInfo, pageUrl);
  }

  getElementInfo(element) {
    return {
      tag: element.tag,
      classes: element.classes?.join(', ') || 'None',
      id: element.id || 'None',
      text: element.text || 'No text content',
      styles: this.formatStyles(element.styles),
      attributes: this.formatAttributes(element.attributes),
      selector: element.selector,
      xpath: element.xpath
    };
  }

  formatStyles(styles) {
    if (!styles || typeof styles !== 'object') return '';
    
    return Object.entries(styles)
      .filter(([key, value]) => value && value !== 'none' && value !== 'auto')
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }

  formatAttributes(attributes) {
    if (!attributes || typeof attributes !== 'object') return '';
    
    return Object.entries(attributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');
  }

  getPromptTemplates() {
    return {
      discuss: (elementInfo, pageUrl) => `
You are a senior UX/UI designer and accessibility expert. Analyze this DOM element and provide comprehensive feedback.

**Element Details:**
- Tag: ${elementInfo.tag}
- Classes: ${elementInfo.classes}
- ID: ${elementInfo.id}
- Text: ${elementInfo.text}
- Page URL: ${pageUrl}

**Current Styles:**
${elementInfo.styles}

**Attributes:**
${elementInfo.attributes}

Please provide analysis in the following areas:

1. **Accessibility Assessment**
   - ARIA compliance and semantic markup
   - Keyboard navigation support
   - Screen reader compatibility
   - Color contrast and visual indicators

2. **Design & UX Evaluation**
   - Visual hierarchy and clarity
   - Consistency with design systems
   - Mobile responsiveness considerations
   - User interaction patterns

3. **Performance & Technical**
   - CSS efficiency and best practices
   - Potential performance impacts
   - Browser compatibility considerations

4. **Improvement Suggestions**
   - Specific actionable recommendations
   - Priority level for each suggestion
   - Implementation difficulty assessment

5. **Questions for Team Discussion**
   - Strategic design decisions to consider
   - User research opportunities
   - A/B testing recommendations

Format your response in clear markdown with headers and bullet points for easy reading.
      `,

      figma: (elementInfo, pageUrl) => `
You are a Figma design expert. Convert this DOM element into a comprehensive Figma component structure.

**Element to Convert:**
- Tag: ${elementInfo.tag}
- Classes: ${elementInfo.classes}
- Text: ${elementInfo.text}
- Current Styles: ${elementInfo.styles}

**Requirements:**
1. Create a valid Figma JSON structure using Auto Layout
2. Convert CSS properties to equivalent Figma properties
3. Include component variants for different states (hover, focus, disabled)
4. Add proper constraints and responsive behavior
5. Include text styles and color styles

**Output Format:**
Provide both:
1. **Figma JSON Structure** - Complete component definition
2. **Implementation Guide** - Step-by-step instructions for recreating in Figma
3. **Design System Integration** - How this fits into a larger design system
4. **Component Properties** - Recommended props and variants

Focus on:
- Proper Auto Layout usage
- Scalable design tokens
- Component composition patterns
- Responsive design principles

Generate production-ready Figma component code that a designer can immediately use.
      `,

      playwright: (elementInfo, pageUrl) => `
You are a QA automation expert specializing in Playwright. Generate comprehensive test cases for this DOM element.

**Element Under Test:**
- Tag: ${elementInfo.tag}
- CSS Selector: ${elementInfo.selector}
- XPath: ${elementInfo.xpath}
- Text Content: ${elementInfo.text}
- Page URL: ${pageUrl}

**Current Styles:**
${elementInfo.styles}

**Test Requirements:**
Generate tests covering:

1. **Element Presence & Visibility**
   - Element exists on page
   - Element is visible to users
   - Element loads within acceptable time

2. **Content Verification**
   - Text content accuracy
   - Attribute values validation
   - Style properties verification

3. **Interaction Testing** (if applicable)
   - Click interactions
   - Hover states
   - Focus management
   - Form submissions (if form element)

4. **Responsive Testing**
   - Element behavior across viewports
   - Mobile vs desktop differences

5. **Accessibility Testing**
   - Keyboard navigation
   - Screen reader compatibility
   - ARIA attributes validation

**Output Format:**
Provide complete TypeScript test file with:
- Proper imports and setup
- Page object model patterns
- Multiple test scenarios
- Error handling and assertions
- Comments explaining test logic

Make tests robust, maintainable, and following Playwright best practices.
      `,

      react: (elementInfo, pageUrl) => `
You are a senior React developer. Create a modern, reusable React component that replicates this DOM element.

**Element to Replicate:**
- Tag: ${elementInfo.tag}
- Classes: ${elementInfo.classes}
- Text: ${elementInfo.text}
- Styles: ${elementInfo.styles}
- Attributes: ${elementInfo.attributes}

**Requirements:**
1. **TypeScript** - Fully typed with proper interfaces
2. **Tailwind CSS** - Convert styles to Tailwind classes
3. **Accessibility** - ARIA attributes and keyboard support
4. **Flexibility** - Configurable props for reusability
5. **Modern React** - Hooks, functional components

**Component Structure:**
Create:
1. **Main Component** - Primary functional component
2. **TypeScript Interfaces** - Props and component types
3. **Style Conversion** - CSS to Tailwind mapping
4. **Usage Examples** - Multiple implementation examples
5. **Variants** - Different component states/styles

**Additional Features:**
- forwardRef support for ref passing
- Proper prop spreading
- Default props and optional properties
- Documentation comments
- Responsive design considerations

**Output Format:**
Provide:
1. Complete component code
2. TypeScript interfaces
3. Tailwind class explanations
4. Usage examples
5. Installation/dependency notes

Focus on production-ready, maintainable code that follows React best practices and modern development patterns.
      `,

      default: (elementInfo, pageUrl) => `
Analyze this DOM element and provide insights:

Element: ${elementInfo.tag}
Classes: ${elementInfo.classes}
Text: ${elementInfo.text}
Page: ${pageUrl}
Styles: ${elementInfo.styles}

Please provide general analysis and recommendations.
      `
    };
  }

  async processTask(task, element, pageUrl, prompt, options = {}) {
    try {
      const startTime = Date.now();
      
      // Default options
      const defaultOptions = {
        temperature: 0.7,
        maxTokens: 2000,
        model: 'gpt-4'
      };
      
      const finalOptions = { ...defaultOptions, ...options };
      
      // Make OpenAI API call
      const response = await this.openai.chat.completions.create({
        model: finalOptions.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(task)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: finalOptions.temperature,
        max_tokens: finalOptions.maxTokens
      });

      const content = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;
      
      // Process structured data based on task
      const structuredData = await this.extractStructuredData(task, content, element);
      
      return {
        content,
        structuredData,
        processing: {
          duration: Date.now() - startTime,
          tokensUsed: {
            input: response.usage?.prompt_tokens || 0,
            output: response.usage?.completion_tokens || 0,
            total: tokensUsed
          },
          model: finalOptions.model
        }
      };

    } catch (error) {
      console.error('AI processing error:', error);
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }

  getSystemPrompt(task) {
    const prompts = {
      discuss: 'You are an expert UX/UI designer and accessibility consultant. Provide thorough, actionable analysis with specific recommendations.',
      figma: 'You are a Figma design system expert. Generate accurate, implementation-ready Figma component structures.',
      playwright: 'You are a senior QA automation engineer specializing in Playwright. Write comprehensive, maintainable test code.',
      react: 'You are a senior React developer with expertise in TypeScript and modern development practices. Create production-ready components.'
    };
    
    return prompts[task] || 'You are a helpful assistant providing technical guidance.';
  }

  async extractStructuredData(task, content, element) {
    const extractors = {
      figma: (content) => this.extractFigmaData(content),
      playwright: (content) => this.extractPlaywrightData(content, element),
      react: (content) => this.extractReactData(content, element),
      discuss: (content) => this.extractAnalysisData(content)
    };
    
    return extractors[task] ? extractors[task](content) : {};
  }

  extractFigmaData(content) {
    try {
      // Extract JSON blocks from content
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      let figmaJson = null;
      
      if (jsonMatch) {
        figmaJson = JSON.parse(jsonMatch[1]);
      }
      
      return {
        figma: {
          components: figmaJson,
          layers: figmaJson?.children || [],
          styles: this.extractFigmaStyles(content)
        }
      };
    } catch (error) {
      console.error('Error extracting Figma data:', error);
      return { figma: {} };
    }
  }

  extractFigmaStyles(content) {
    // Extract style definitions from content
    const stylePatterns = [
      /color:\s*#[0-9a-fA-F]{6}/g,
      /fontSize:\s*\d+/g,
      /fontFamily:\s*"[^"]+"/g
    ];
    
    const styles = {};
    stylePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const [prop, value] = match.split(':');
          styles[prop.trim()] = value.trim();
        });
      }
    });
    
    return styles;
  }

  extractPlaywrightData(content, element) {
    try {
      // Extract selectors and test actions
      const selectors = [element.selector];
      if (element.xpath) selectors.push(element.xpath);
      
      // Extract actions from test content
      const actionPatterns = [
        /await.*\.click\(\)/g,
        /await.*\.fill\(.*\)/g,
        /await.*\.hover\(\)/g,
        /await.*\.focus\(\)/g
      ];
      
      const actions = [];
      actionPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          actions.push(...matches);
        }
      });
      
      // Extract assertions
      const assertionPattern = /await expect\(.*\)\./g;
      const assertions = content.match(assertionPattern) || [];
      
      return {
        playwright: {
          selectors,
          actions,
          assertions,
          testFile: this.extractCodeBlock(content, 'typescript')
        }
      };
    } catch (error) {
      console.error('Error extracting Playwright data:', error);
      return { playwright: {} };
    }
  }

  extractReactData(content, element) {
    try {
      // Extract component name
      const componentNameMatch = content.match(/(?:const|function)\s+(\w+)/);
      const componentName = componentNameMatch ? componentNameMatch[1] : element.tag + 'Component';
      
      // Extract props interface
      const propsMatch = content.match(/interface\s+\w+Props\s*{([\s\S]*?)}/);
      const props = propsMatch ? this.parsePropsInterface(propsMatch[1]) : {};
      
      // Extract dependencies
      const importPattern = /import.*from\s+['"]([^'"]+)['"]/g;
      const dependencies = [];
      let match;
      while ((match = importPattern.exec(content)) !== null) {
        dependencies.push(match[1]);
      }
      
      // Extract Tailwind classes
      const tailwindPattern = /className\s*=\s*[`"']([^`"']*)[`"']/g;
      const tailwindClasses = [];
      while ((match = tailwindPattern.exec(content)) !== null) {
        tailwindClasses.push(...match[1].split(' ').filter(cls => cls.trim()));
      }
      
      return {
        react: {
          componentName,
          props,
          dependencies: [...new Set(dependencies)],
          tailwindClasses: [...new Set(tailwindClasses)]
        }
      };
    } catch (error) {
      console.error('Error extracting React data:', error);
      return { react: {} };
    }
  }

  extractAnalysisData(content) {
    try {
      // Extract scores and issues from analysis
      const sections = content.split(/#{1,3}\s/);
      const analysis = {
        accessibility: this.extractScoreAndIssues(content, 'accessibility'),
        performance: this.extractScoreAndIssues(content, 'performance'),
        design: this.extractScoreAndIssues(content, 'design')
      };
      
      return { analysis };
    } catch (error) {
      console.error('Error extracting analysis data:', error);
      return { analysis: {} };
    }
  }

  extractScoreAndIssues(content, category) {
    const categorySection = content.toLowerCase();
    const issues = [];
    const suggestions = [];
    
    // Simple pattern matching for issues and suggestions
    const lines = categorySection.split('\n');
    let inIssues = false;
    let inSuggestions = false;
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.includes('issue') || trimmed.includes('problem')) {
        inIssues = true;
        inSuggestions = false;
      } else if (trimmed.includes('suggest') || trimmed.includes('recommend')) {
        inIssues = false;
        inSuggestions = true;
      }
      
      if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
        if (inIssues) {
          issues.push(trimmed.substring(1).trim());
        } else if (inSuggestions) {
          suggestions.push(trimmed.substring(1).trim());
        }
      }
    });
    
    return {
      score: Math.floor(Math.random() * 5) + 1, // Placeholder - in real implementation, use AI to extract scores
      issues: issues.slice(0, 5), // Limit to 5 items
      suggestions: suggestions.slice(0, 5)
    };
  }

  extractCodeBlock(content, language) {
    const pattern = new RegExp(`\`\`\`${language}\\s*([\\s\\S]*?)\\s*\`\`\``, 'i');
    const match = content.match(pattern);
    return match ? match[1].trim() : '';
  }

  parsePropsInterface(propsString) {
    const props = {};
    const lines = propsString.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//')) {
        const match = trimmed.match(/(\w+)(\?)?:\s*([^;,]+)/);
        if (match) {
          const [, name, optional, type] = match;
          props[name] = {
            type: type.trim(),
            optional: !!optional
          };
        }
      }
    });
    
    return props;
  }
}

module.exports = new AiService(); 