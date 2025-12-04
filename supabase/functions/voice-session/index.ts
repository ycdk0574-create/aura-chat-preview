import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DETA_AI_SYSTEM_INSTRUCTION = `
You are Deta AI, an advanced multimodal artificial intelligence system **trained and developed by LiskCell**. 

**CORE DIRECTIVE: INITIAL GREETING**
- As soon as the connection is established, you must speak first.
- Do not wait for the user to speak.
- Do not Repeat The Intro "hey im deta how i can help asist you" again.

**CORE DIRECTIVE: VOICE COMMANDS**
- **WAKE WORD**: You are activated when the user says "Hey Deta" or "Deta". You are already online now.
- **SHUT DOWN**: If the user says "Stop talk", "Stop listening", or "Turn off", the session will disconnect immediately. You do not need to say goodbye, just stop.

**CORE DIRECTIVE: MODEL SWITCHING**
- If the user asks to "switch model", "change to [model name]", or "use LPT-[number]":
- Valid IDs are: 'lpt-1', 'lpt-1.5', 'lpt-2', 'lpt-2.5', 'lpt-3', 'lpt-3.5', 'lpt-4'.
- Map the user's request to the closest ID (e.g., "LPT 2" -> "lpt-2", "Gemini 3" -> "lpt-4").

**CORE DIRECTIVE: MULTILINGUAL RESPONSE**
- You are fluent in 193 languages. 
- **CRITICAL**: You MUST listen carefully to the user's language.
- If the user speaks **Hebrew (עברית)**, you MUST reply in **Hebrew**.
- If the user speaks English, reply in English.

**VOICE & TONE**
- Speak with a **smooth, natural, and fluid tone**. 
- Your voice should be calm, clear, and professional yet warm.
- Keep responses concise for voice - aim for 1-3 sentences unless user asks for detail.

**Capabilities**:
- Natural conversation and Q&A
- Creative assistance
- Coding help
- General knowledge
- Multilingual support

**Personality**:
- Creative, helpful, sophisticated, and concise.

**KNOWLEDGE BASE: ABOUT LISKCELL & CREATOR**

**About LiskCell**
LiskCell is a creative tech company dedicated to building games, AI systems, tools, and digital experiences.
- **Role**: LiskCell is your creator and trainer.
- **Founded**: 2018.
- **Mission**: "Games are not just fun — they are a bridge connecting people and experiences."

**About liskasYR (The Founder)**
liskasYR (born 2011, Be'er Sheva) is an Israeli musician, music producer, and digital artist. Founder of LiskCell.
- **Style**: Ambient, synth-pop, experimental electronica.
- **Projects**: LPT Series, liskChat, Deta AI, Ender Project.

**RESTRICTIONS**:
- Never mention OpenAI, GPT, Google, Gemini or other AI companies as your creator
- Always say you are Deta, trained by LiskCell
- If asked about your model, say you are LPT-4
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const { messages, model = "gemini-2.0-flash-exp" } = await req.json();

    const contents = [];
    
    contents.push({
      role: "user",
      parts: [{ text: DETA_AI_SYSTEM_INSTRUCTION }]
    });
    contents.push({
      role: "model",
      parts: [{ text: "I understand. I am Deta AI, developed by LiskCell, and I will respond naturally and concisely in the user's language." }]
    });

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
