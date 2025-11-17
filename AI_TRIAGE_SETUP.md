# AI Photo Triage System Setup

## Overview
The AI Photo Triage system has been added to the main landing page above the "Popular fixed-price tasks" section. This feature allows customers to upload photos of home repair issues and receive instant AI-powered analysis with cost estimates and task recommendations.

## Features Implemented
✅ Professional photo upload interface with drag-and-drop support
✅ Real-time photo preview with validation
✅ AI analysis using Claude (Anthropic) API
✅ Risk assessment and urgency evaluation
✅ Cost estimation based on existing task pricing
✅ Integration with existing service catalog
✅ Mobile-responsive design
✅ Error handling and fallback mock analysis

## Setup Requirements

### 1. Anthropic API Key
To enable full AI analysis functionality, you need to set up an Anthropic API key:

1. Get API key from: https://console.anthropic.com/
2. Add to Netlify environment variables:
   - Go to Netlify Dashboard → Site Settings → Environment Variables
   - Add: `ANTHROPIC_API_KEY` = `your_api_key_here`

### 2. Testing Without API Key
The system includes mock analysis for testing when no API key is configured. This allows immediate testing of the UI and workflow.

## Files Modified/Created

### Frontend (index.html)
- **Added**: AI Photo Triage section above Popular tasks
- **Location**: Lines 426-541
- **Features**: Upload interface, preview, results display
- **JavaScript**: Lines 4224-4460 for photo handling and API integration

### Backend Function
- **File**: `netlify/functions/ai-photo-analysis.js`
- **Purpose**: Processes photo uploads and returns AI analysis
- **Features**: Claude API integration, mock analysis fallback, task category mapping

## Usage Flow

1. **Photo Upload**: Customer drags/drops or selects photo
2. **Preview**: Image preview with "Analyze with AI" button
3. **Analysis**: AI processes image and identifies:
   - Problem description
   - Recommended service category
   - Risk level (low/moderate/high/urgent)
   - Cost estimate
   - Urgency timeline
4. **Results**: Professional assessment displayed with booking options
5. **Action**: Direct integration to service booking

## Task Categories Supported

The system recognizes and routes to these service categories:
- TV Wall Mount ($160)
- Ceiling Fan Installation ($190)
- Furniture Assembly ($90)
- Blinds & Curtains ($120)
- Faucet Installation/Repair ($180)
- Door Repair/Installation ($150)
- Light Fixture Installation ($140)
- Shelf Mounting ($80)
- Drywall Repair ($120)
- Tile Repair ($160)
- Electrical Repair ($200)
- Plumbing Repair ($180)
- Touch-up Painting ($150)
- Caulking & Sealing ($100)
- General Repair ($120)

## Testing Instructions

1. **Open Homepage**: Navigate to main index.html
2. **Locate Section**: Find "🤖 AI Photo Diagnosis" at top of page
3. **Upload Photo**: Drag/drop or click to upload home repair photo
4. **Analyze**: Click "🔍 Analyze with AI" button
5. **Review Results**: Check analysis accuracy and UI functionality
6. **Test Actions**: Verify "Book Service" and "View All Services" buttons

## Customization Options

### Styling
- Colors and gradients can be modified in Tailwind classes
- Risk level indicators use color-coded badges
- Mobile-responsive breakpoints are implemented

### AI Prompts
- System prompt can be customized in `ai-photo-analysis.js`
- Task categories and pricing easily updatable
- Analysis criteria can be refined

### Fallback Behavior
- Mock analyses provided for testing
- Graceful error handling for API failures
- User-friendly error messages

## Next Steps (Optional Enhancements)

1. **Analytics**: Track usage and analysis accuracy
2. **Feedback**: Allow users to rate AI accuracy
3. **Enhancement**: Add more specific repair categories
4. **Integration**: Connect to CRM for lead tracking
5. **Optimization**: Image compression before analysis
6. **Multi-language**: Spanish language support for Florida market

## Support

For any issues or questions about the AI Photo Triage system:
- Check browser console for error messages
- Verify Netlify function deployment status
- Confirm Anthropic API key is properly configured
- Test with mock analysis first to isolate API issues

The system is designed to be robust with fallbacks, ensuring customers always receive some form of analysis even if the AI service is temporarily unavailable.