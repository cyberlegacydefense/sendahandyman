// netlify/functions/ai-photo-analysis.js
// AI Photo Triage System for SendAHandyman.com

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

// Task categories with exact pricing from current website
const TASK_CATEGORIES = {
  'tv_mount': { name: 'TV Wall Mount (32–65")', price: 'Starting at $160' },
  'ceiling_fan': { name: 'Ceiling Fan Install/Replace', price: 'Starting at $160' },
  'light_fixture': { name: 'Light Fixture / Chandelier Swap', price: 'Starting at $120' },
  'faucet_repair': { name: 'Faucet / Showerhead Replace', price: 'Starting at $120' },
  'smart_doorbell': { name: 'Smart Doorbell Install', price: 'Starting at $100' },
  'blinds_installation': { name: 'Curtain Rods / Blinds', price: 'Starting at $120' },
  'shelf_mounting': { name: 'Floating Shelf Install', price: 'Starting at $120' },
  'appliance_hookup': { name: 'Appliance Hookup (W/D/DW)', price: 'Starting at $160' },
  'furniture_assembly': { name: 'Furniture Assembly (S–M)', price: 'Starting at $160' },
  'closet_organizer': { name: 'Closet Organizer Install', price: 'Starting at $200' },
  'electrical_repair': { name: 'Electrical Repair', price: 'Starting at $160' },
  'plumbing_repair': { name: 'Plumbing Repair', price: 'Starting at $120' },
  'drywall_repair': { name: 'Drywall Repair', price: 'Starting at $120' },
  'door_repair': { name: 'Door Repair/Installation', price: 'Starting at $120' },
  'general_repair': { name: 'General Handyman Service', price: 'Starting at $120' }
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
1. Examine the image for visible damage, wear, or repair needs
2. Identify the specific problem and its severity
3. Recommend the most appropriate task category from the list above
4. Assess risk level: low, moderate, high, or urgent
5. Provide cost estimates based on our Florida market pricing
6. Include urgency notes for homeowner guidance

RESPONSE FORMAT (JSON only):
{
  "problem_description": "Clear description of the identified issue",
  "recommended_task": "Most appropriate task category name",
  "task_category": "category_key_from_list",
  "cost_estimate": "Price range (e.g., '$120 - $180')",
  "risk_level": "low/moderate/high/urgent",
  "urgency_notes": "Professional guidance on timing and next steps",
  "confidence_level": "high/medium/low"
}

GUIDELINES:
- Be conservative with risk assessments - safety first
- Consider Florida-specific factors (humidity, weather)
- If unclear, recommend general consultation
- Focus on visible issues, avoid speculation
- Provide practical, actionable advice`;

  // Check if API key is available
  if (!process.env.CLAUDE_API_KEY) {
    console.warn('⚠️ CLAUDE_API_KEY not found - using mock analysis');
    return createMockAnalysis();
  }

  // Note: Mock analysis removed - now using real Claude vision

  console.log('🤖 Making Claude API call...');
  console.log('API Key available:', !!process.env.CLAUDE_API_KEY);
  console.log('Image media type:', getImageMediaType(base64Image));

  try {
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
      })
    });

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
      status: error.status,
      stack: error.stack
    });

    // Log more details for debugging
    if (error.response) {
      console.error('API Response Error:', await error.response.text());
    }

    // Return a generic analysis if AI fails
    return {
      problem_description: `API Error: ${error.message}. Using fallback analysis for testing.`,
      recommended_task: "General Repair Consultation",
      task_category: "general_repair",
      cost_estimate: "$120 - $200",
      risk_level: "moderate",
      urgency_notes: "For a proper assessment, we recommend scheduling a consultation with one of our handymen.",
      confidence_level: "low"
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
  }
  return 'image/jpeg'; // default
}

function createFallbackAnalysis(responseText) {
  // Try to extract useful information from non-JSON response
  const lowerText = responseText.toLowerCase();

  let taskCategory = 'general_repair';
  let riskLevel = 'moderate';

  // Basic keyword matching
  if (lowerText.includes('electrical') || lowerText.includes('wire') || lowerText.includes('outlet')) {
    taskCategory = 'electrical_repair';
    riskLevel = 'high';
  } else if (lowerText.includes('plumbing') || lowerText.includes('leak') || lowerText.includes('faucet')) {
    taskCategory = 'plumbing_repair';
  } else if (lowerText.includes('drywall') || lowerText.includes('wall') || lowerText.includes('hole')) {
    taskCategory = 'drywall_repair';
  } else if (lowerText.includes('tile') || lowerText.includes('grout')) {
    taskCategory = 'tile_repair';
  } else if (lowerText.includes('door')) {
    taskCategory = 'door_repair';
  } else if (lowerText.includes('paint')) {
    taskCategory = 'painting';
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
    recommended_task: "General Repair Consultation",
    task_category: "general_repair",
    cost_estimate: "$120 - $200",
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

  // Validate task category exists
  if (!TASK_CATEGORIES[analysis.task_category]) {
    analysis.task_category = "general_repair";
    analysis.recommended_task = "General Repair Consultation";
    analysis.cost_estimate = "$120 - $200";
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
  // Mock analysis for testing when API key is not available
  const mockAnalyses = [
    {
      problem_description: "Damaged drywall with visible hole that needs professional repair",
      recommended_task: "Drywall Repair",
      task_category: "drywall_repair",
      cost_estimate: "$120 - $180",
      risk_level: "moderate",
      urgency_notes: "This repair should be addressed within a week to prevent further damage and maintain home value.",
      confidence_level: "high"
    },
    {
      problem_description: "Loose or malfunctioning electrical outlet requiring immediate attention",
      recommended_task: "Electrical Repair",
      task_category: "electrical_repair",
      cost_estimate: "$200 - $300",
      risk_level: "high",
      urgency_notes: "Electrical issues can be dangerous and should be addressed by a licensed professional immediately.",
      confidence_level: "high"
    },
    {
      problem_description: "Water damage or staining around plumbing fixtures",
      recommended_task: "Plumbing Repair",
      task_category: "plumbing_repair",
      cost_estimate: "$180 - $250",
      risk_level: "moderate",
      urgency_notes: "Water issues can lead to mold and structural damage if not addressed promptly.",
      confidence_level: "medium"
    }
  ];

  // Return a random mock analysis
  const randomIndex = Math.floor(Math.random() * mockAnalyses.length);
  return mockAnalyses[randomIndex];
}