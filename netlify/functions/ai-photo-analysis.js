// netlify/functions/ai-photo-analysis.js
// AI Photo Triage System for SendAHandyman.com

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

// Task categories with exact pricing from current website (as of Nov 2024)
const TASK_CATEGORIES = {
  'tv_mount': { name: 'TV Wall Mount (32–65")', price: 'Starting at $160', hours: '~2.0 hr base' },
  'ceiling_fan': { name: 'Ceiling Fan Install/Replace', price: 'Starting at $160', hours: '~2.0 hr base' },
  'light_fixture': { name: 'Light Fixture / Chandelier Swap', price: 'Starting at $120', hours: '~1.5 hr base' },
  'faucet_showerhead': { name: 'Faucet / Showerhead Replace', price: 'Starting at $120', hours: '~1.5 hr base' },
  'smart_doorbell': { name: 'Smart Doorbell Install', price: 'Starting at $100', hours: '~1.25 hr base' },
  'curtains_blinds': { name: 'Curtain Rods / Blinds', price: 'Starting at $80', hours: '~1 hr per item' },
  'floating_shelf': { name: 'Floating Shelf Install', price: 'Starting at $80', hours: '~1 hr per item' },
  'appliance_hookup': { name: 'Appliance Hookup (W/D/DW)', price: 'Starting at $160', hours: '~2.0 hr base' },
  'furniture_assembly': { name: 'Furniture Assembly (S–M)', price: 'Starting at $160', hours: '~2.0 hr base' },
  'closet_organizer': { name: 'Closet Organizer Install', price: 'Starting at $200', hours: '~2.5 hr base' },
  'premium_moveout': { name: 'Premium Move-out Repairs', price: 'Starting at $300', hours: '~3.0 hr base' },
  'general_handyman': { name: 'General Handyman (3+ hours)', price: 'Starting at $240', hours: '~3 hr minimum' }
};

export const handler = async (event, context) => {
  console.log('🤖 AI Photo Analysis function started');

  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders };
    }

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

    let requestData;
    try {
      requestData = JSON.parse(event.body || "{}");
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid request data" })
      };
    }

    const { image, filename } = requestData;

    if (!image) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Image data is required" })
      };
    }

    console.log(`🔍 Analyzing image: ${filename || 'unnamed'}`);
    console.log('Image data info:', {
      hasImage: !!image,
      imageLength: image?.length,
      imagePrefix: image?.substring(0, 50) + '...',
      isBase64: image?.startsWith('data:image')
    });

    // Call Claude API for image analysis
    const analysis = await analyzeImageWithClaude(image, filename);

    console.log('✅ AI analysis completed:', {
      problem: analysis.problem_description,
      task: analysis.recommended_task,
      risk: analysis.risk_level
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(analysis)
    };

  } catch (error) {
    console.error('❌ AI photo analysis error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Analysis failed',
        detail: error.message
      })
    };
  }
};

async function analyzeImageWithClaude(base64Image, filename) {
  // Expert home repair triage system prompt
  const systemPrompt = `You are an expert home repair triage assistant for SendAHandyman.com, a Florida-based 'Uber for handyman' service.

TASK CATEGORIES AND PRICING:
${Object.entries(TASK_CATEGORIES).map(([key, value]) => `- ${key}: ${value.name} (${value.price})`).join('\n')}

Your role is to analyze home repair photos and provide professional assessments in JSON format.

ANALYSIS REQUIREMENTS:
1. First describe EXACTLY what you see in the image in detail
2. Examine the image for visible damage, wear, or repair needs
3. Identify the specific problem and its severity
4. CRITICAL: Only recommend services from our EXACT list above - use the exact task_category key
5. If the issue doesn't fit our specific services, recommend "general_handyman" and explain limitations
6. Use EXACT pricing from the list - never make up prices
7. Assess risk level: low, moderate, high, or urgent
8. Include urgency notes for homeowner guidance

SERVICE MATCHING RULES:
- FENCE/GATE repairs (collapsed, broken, damaged fencing) → ALWAYS use "general_handyman" ($240+ for 3+ hour jobs)
- FENCE posts, pickets, privacy fences, wood fencing → "general_handyman"
- DRYWALL holes/patches → "general_handyman" (we don't offer specific drywall service)
- PAINTING → "general_handyman" (we don't offer standalone painting)
- PLUMBING beyond faucets → "general_handyman"
- ELECTRICAL beyond doorbell → "general_handyman"
- ROOF/GUTTERS → NOT OFFERED - explain we don't do roofing
- MAJOR CONSTRUCTION → NOT OFFERED - recommend contractors

IMPORTANT: FENCE repairs of ANY type (collapsed, damaged, broken posts, etc.) are ALWAYS "general_handyman" - NEVER "out_of_scope"

OUT-OF-SCOPE HANDLING:
Only use this for repairs we truly cannot do (roofing, major plumbing, HVAC, structural foundation, etc.).
FENCING is NOT out-of-scope - always use "general_handyman" for fence issues.
If the repair is outside our service list, respond with:
- problem_description: Clearly identify the issue
- recommended_task: "Service not offered"
- task_category: "out_of_scope"
- cost_estimate: "Not available - outside our service area"
- urgency_notes: "For [specific issue], we recommend contacting a specialized [type] contractor. This falls outside our handyman services."

IMPORTANT: Always use EXACT pricing from the task list. Never estimate or modify prices.

RESPONSE FORMAT (JSON only):
{
  "problem_description": "Clear description of the identified issue",
  "recommended_task": "EXACT name from task list OR 'Service not offered'",
  "task_category": "EXACT key from list OR 'out_of_scope'",
  "cost_estimate": "EXACT price from list OR 'Not available - outside our service area'",
  "risk_level": "low/moderate/high/urgent",
  "urgency_notes": "Professional guidance on timing and next steps",
  "confidence_level": "high/medium/low"
}

GUIDELINES:
- Be conservative with risk assessments - safety first
- Consider Florida-specific factors (humidity, weather)
- If unclear, recommend general_handyman consultation
- Focus on visible issues, avoid speculation
- Always use exact service names and pricing from our list`;

  // Check if API key is available
  if (!process.env.CLAUDE_API_KEY) {
    console.warn('⚠️ CLAUDE_API_KEY not found - using mock analysis');
    return createMockAnalysis();
  }

  // Note: Mock analysis removed - now using real Claude vision

  // Check if image format is supported
  const mediaType = getImageMediaType(base64Image);
  console.log('🤖 Making Claude API call...');
  console.log('API Key available:', !!process.env.CLAUDE_API_KEY);
  console.log('Image media type:', mediaType);

  if (!mediaType) {
    // Detect actual format from data URI
    const formatMatch = base64Image.match(/^data:image\/([a-zA-Z+]+);/);
    const detectedFormat = formatMatch ? formatMatch[1].toLowerCase() : 'unknown';

    console.error('❌ Unsupported image format:', detectedFormat);
    return {
      problem_description: `Sorry, ${detectedFormat.toUpperCase()} image format is not supported. Please upload your image in JPEG, PNG, WebP, or GIF format for AI analysis.`,
      recommended_task: "General Repair Consultation",
      task_category: "general_repair",
      cost_estimate: "$120 - $200",
      risk_level: "moderate",
      urgency_notes: `Please convert your ${detectedFormat.toUpperCase()} image to a supported format (JPEG, PNG, WebP, or GIF) and try again. Alternatively, take a new photo directly with your camera.`,
      confidence_level: "low",
      error_type: "unsupported_format",
      supported_formats: getSupportedFormats()
    };
  }

  try {
    // Create an AbortController for the Claude API call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this home repair photo and provide a professional assessment following the JSON format specified in your system prompt.'
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: getImageMediaType(base64Image),
                  data: base64Image.split(',')[1] // Remove data:image/... prefix
                }
              }
            ]
          }
        ],
        system: systemPrompt
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API Response Error:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText
      });
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const analysisText = result.content[0].text;

    // Parse JSON response
    let analysis;
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : analysisText;
      analysis = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse Claude response as JSON:', parseError);
      console.log('Raw response:', analysisText);

      // Fallback analysis if JSON parsing fails
      analysis = createFallbackAnalysis(analysisText);
    }

    // Validate and enhance the analysis
    analysis = validateAndEnhanceAnalysis(analysis);

    return analysis;

  } catch (error) {
    console.error('Claude API error details:', {
      message: error.message,
      name: error.name,
      status: error.status,
      stack: error.stack
    });

    // Handle specific error types
    if (error.name === 'AbortError') {
      console.error('Claude API timeout after 20 seconds');
      return {
        problem_description: "Based on your photo, this appears to be a general repair task that would benefit from professional assessment.",
        recommended_task: "General Handyman (3+ hours)",
        task_category: "general_handyman",
        cost_estimate: "Starting at $240",
        risk_level: "moderate",
        urgency_notes: "For the most accurate assessment and pricing, our handyman will evaluate the specific requirements during the appointment.",
        confidence_level: "medium",
        error_type: "timeout"
      };
    }

    // Log more details for debugging
    if (error.response) {
      console.error('API Response Error:', await error.response.text());
    }

    // Return a generic analysis if AI fails
    return {
      problem_description: "Based on your photo, this appears to be a repair task that requires professional evaluation to determine the best approach.",
      recommended_task: "General Handyman (3+ hours)",
      task_category: "general_handyman",
      cost_estimate: "Starting at $240",
      risk_level: "moderate",
      urgency_notes: "Our handyman will assess the specific requirements and provide accurate pricing during the appointment.",
      confidence_level: "medium"
    };
  }
}

function getImageMediaType(base64Image) {
  if (base64Image.startsWith('data:image/jpeg') || base64Image.startsWith('data:image/jpg')) {
    return 'image/jpeg';
  } else if (base64Image.startsWith('data:image/png')) {
    return 'image/png';
  } else if (base64Image.startsWith('data:image/webp')) {
    return 'image/webp';
  } else if (base64Image.startsWith('data:image/gif')) {
    return 'image/gif';
  }

  // Note: Claude API doesn't support AVIF format
  // Return null for unsupported formats to trigger proper error handling
  return null;
}

function getSupportedFormats() {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
}

function isFormatSupported(mediaType) {
  return getSupportedFormats().includes(mediaType);
}

function createFallbackAnalysis(responseText) {
  // Try to extract useful information from non-JSON response
  const lowerText = responseText.toLowerCase();

  let taskCategory = 'general_handyman';
  let riskLevel = 'moderate';

  // Basic keyword matching to our actual services
  if (lowerText.includes('tv') || lowerText.includes('mount') || lowerText.includes('bracket')) {
    taskCategory = 'tv_mount';
  } else if (lowerText.includes('fan') || lowerText.includes('ceiling fan')) {
    taskCategory = 'ceiling_fan';
  } else if (lowerText.includes('light') || lowerText.includes('fixture') || lowerText.includes('chandelier')) {
    taskCategory = 'light_fixture';
  } else if (lowerText.includes('fence') || lowerText.includes('fencing') || lowerText.includes('gate') || lowerText.includes('picket') || lowerText.includes('privacy fence') || lowerText.includes('collapsed') || lowerText.includes('fence post')) {
    taskCategory = 'general_handyman'; // Fence repairs always go to general handyman
  } else if (lowerText.includes('faucet') || lowerText.includes('showerhead')) {
    taskCategory = 'faucet_showerhead';
  } else if (lowerText.includes('doorbell') || lowerText.includes('ring')) {
    taskCategory = 'smart_doorbell';
  } else if (lowerText.includes('curtain') || lowerText.includes('blind') || lowerText.includes('rod')) {
    taskCategory = 'curtains_blinds';
  } else if (lowerText.includes('shelf') || lowerText.includes('floating')) {
    taskCategory = 'floating_shelf';
  } else if (lowerText.includes('appliance') || lowerText.includes('washer') || lowerText.includes('dryer')) {
    taskCategory = 'appliance_hookup';
  } else if (lowerText.includes('furniture') || lowerText.includes('assembly') || lowerText.includes('ikea')) {
    taskCategory = 'furniture_assembly';
  } else if (lowerText.includes('closet') || lowerText.includes('organizer')) {
    taskCategory = 'closet_organizer';
  }

  return {
    problem_description: responseText.substring(0, 200) + "...",
    recommended_task: TASK_CATEGORIES[taskCategory].name,
    task_category: taskCategory,
    cost_estimate: TASK_CATEGORIES[taskCategory].price,
    risk_level: riskLevel,
    urgency_notes: "Based on the analysis, we recommend professional assessment and repair.",
    confidence_level: "low"
  };
}

function validateAndEnhanceAnalysis(analysis) {
  // Ensure all required fields exist
  const required = {
    problem_description: "Home repair issue identified in photo",
    recommended_task: "General Handyman (3+ hours)",
    task_category: "general_handyman",
    cost_estimate: "Starting at $240",
    risk_level: "moderate",
    urgency_notes: "Professional assessment recommended",
    confidence_level: "medium"
  };

  // Fill in missing fields
  Object.keys(required).forEach(key => {
    if (!analysis[key]) {
      analysis[key] = required[key];
    }
  });

  // Handle out-of-scope services
  if (analysis.task_category === "out_of_scope") {
    analysis.recommended_task = "Service not offered";
    analysis.cost_estimate = "Not available - outside our service area";
    return analysis;
  }

  // Validate task category exists in our service list
  if (!TASK_CATEGORIES[analysis.task_category]) {
    console.warn(`Unknown task category: ${analysis.task_category}, defaulting to general_handyman`);
    analysis.task_category = "general_handyman";
    analysis.recommended_task = "General Handyman (3+ hours)";
    analysis.cost_estimate = "Starting at $240";
  }

  // Ensure cost estimate matches task category if available
  if (TASK_CATEGORIES[analysis.task_category]) {
    const taskInfo = TASK_CATEGORIES[analysis.task_category];
    if (!analysis.cost_estimate.includes(taskInfo.price)) {
      analysis.cost_estimate = taskInfo.price;
    }
  }

  // Validate risk level
  const validRiskLevels = ['low', 'moderate', 'high', 'urgent'];
  if (!validRiskLevels.includes(analysis.risk_level.toLowerCase())) {
    analysis.risk_level = 'moderate';
  }

  return analysis;
}

function createMockAnalysis() {
  // Realistic mock analysis based on actual service categories
  const mockAnalyses = [
    {
      problem_description: "Image shows a ceiling fan installation or replacement need. The existing fixture requires professional handyman assessment.",
      recommended_task: "Ceiling Fan Install/Replace",
      task_category: "ceiling_fan",
      cost_estimate: "Starting at $160",
      risk_level: "moderate",
      urgency_notes: "This installation should be completed by a licensed professional for safety and proper electrical connection.",
      confidence_level: "high"
    },
    {
      problem_description: "TV mounting hardware and wall preparation visible. Professional installation recommended for safety.",
      recommended_task: "TV Wall Mount (32–65\")",
      task_category: "tv_mount",
      cost_estimate: "Starting at $160",
      risk_level: "moderate",
      urgency_notes: "Professional mounting ensures proper wall support and prevents damage to your TV and wall.",
      confidence_level: "high"
    },
    {
      problem_description: "General repair task visible that would benefit from professional handyman assessment and completion.",
      recommended_task: "General Handyman (3+ hours)",
      task_category: "general_handyman",
      cost_estimate: "Starting at $240",
      risk_level: "moderate",
      urgency_notes: "Our handyman will evaluate the specific requirements and provide accurate pricing during the appointment.",
      confidence_level: "medium"
    }
  ];

  // Return a random mock analysis
  const randomIndex = Math.floor(Math.random() * mockAnalyses.length);
  return mockAnalyses[randomIndex];
}