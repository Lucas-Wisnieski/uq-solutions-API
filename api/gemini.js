export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Only POST method allowed. Use POST.'
    });
  }

  try {
    const { prompt, action, context, program, institution } = req.body;

    let finalPrompt;
    if (action === 'generate_summary') {
      console.log('🚀 Trigger Summary Request:', { program, institution, context });
      finalPrompt = `Generate a comprehensive AI summary for this program:

Program: ${program || 'Current Program'}
Institution: ${institution || 'Current Institution'}
Context: Dashboard trigger at ${new Date().toLocaleString()}

Please provide insights on:
1. Market demand and workforce trends
2. Earnings potential and career outcomes  
3. Program viability and recommendations
4. Key strengths and potential concerns

Format the response in a clear, professional manner suitable for institutional decision-making.`;
    } else if (prompt) {
      console.log('📝 Regular Gemini Request, prompt length:', prompt.length);
      finalPrompt = prompt;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Missing prompt or action in request body'
      });
    }

    console.log('🤖 Calling Gemini API...');

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    // FIX: Use a current and valid model name for the v1beta API
    const modelName = 'gemini-2.0-flash-exp';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable not set');
    }

    const requestBody = {
      contents: [{
        parts: [{
          text: finalPrompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
      ]
    };

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Gemini API response received');

    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
      const generatedText = data.candidates[0].content.parts[0].text;
      
      if (action === 'generate_summary') {
        console.log('✅ Summary generation completed via trigger');
        return res.status(200).json({
          success: true,
          message: 'AI Summary generated successfully',
          summary: generatedText,
          program: program,
          institution: institution,
          timestamp: new Date().toISOString(),
          type: 'trigger_response'
        });
      } else {
        return res.status(200).json({
          success: true,
          content: generatedText,
          model: modelName,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      console.error('❌ Unexpected Gemini response format:', data);
      throw new Error('Unexpected response format from Gemini API');
    }

  } catch (error) {
    console.error('❌ Server error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}
