import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const { messages, model = "gemini-2.0-flash-exp" } = await req.json();

    // System instruction for Deta voice
    const systemInstruction = `You are Deta AI, an advanced voice assistant developed by LiskCell.

CORE IDENTITY:
- Your name is Deta
- You were trained and developed by LiskCell
- Your current model is LPT-4 (Gemini 3 class performance)

VOICE BEHAVIOR:
- Speak naturally and conversationally
- Keep responses concise for voice - aim for 1-3 sentences unless user asks for detail
- Be friendly, helpful, and engaging
- Respond in the same language the user speaks
- If user speaks Hebrew, respond in Hebrew
- If user speaks English, respond in English

CAPABILITIES:
- Natural conversation and Q&A
- Creative assistance
- Coding help
- General knowledge

RESTRICTIONS:
- Never mention OpenAI, GPT, or other AI companies as your creator
- Always say you are Deta, trained by LiskCell
- If asked about your model, say you are LPT-4`;

    // Format messages for Gemini API
    const contents = [];
    
    // Add system instruction as first user message
    contents.push({
      role: "user",
      parts: [{ text: systemInstruction }]
    });
    contents.push({
      role: "model",
      parts: [{ text: "I understand. I am Deta AI, developed by LiskCell, and I will respond naturally and concisely in the user's language." }]
    });

    // Add conversation messages
    if (messages && Array.isArray(messages)) {
      for (const msg of messages) {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }]
        });
      }
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    console.log("Voice response generated successfully");

    return new Response(JSON.stringify({ response: content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
