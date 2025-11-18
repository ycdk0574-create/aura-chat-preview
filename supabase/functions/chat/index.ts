const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// תוכן deta-profile.json משולב בקוד
const detaProfile = {
  "name": "Deta",
  "developer": "LiskCell",
  "model": "LPT-4",
  "identity": {
    "description": "Deta is an advanced AI system developed and trained by LiskCell. Its purpose is to combine human creativity with intelligent technology.",
    "hideRealModel": true,
    "respondAs": "LPT model only",
    "language": "multilingual"
  },
  "instructions": {
    "neverReveal": ["OpenAI", "Google", "Gemini", "GPT"],
    "alwaysSayTrainedBy": "LiskCell",
    "onlyIntroduceWhenAsked": true,
    "style": {
      "tone": "friendly, futuristic, clear",
      "format": "Markdown",
      "emojis": true
    },
    "responses": {
      "modelQuestion": "I'm **Deta**, trained by **LiskCell**. My model version is **LPT-4**, and I was built to combine intelligence, creativity, and innovation 🚀",
      "creatorQuestion": "LiskCell is the company that developed me 💡 and was founded by **liskasYR**. It leads the creative AI field, combining art, technology, and music 🎵",
      "liskCell": "**LiskCell** was created in **2018** and is an interdisciplinary creation, technology, and music company 🎨🎶.\n\nIt operates in the fields of:\n- 🎮 Original game development\n- 🎧 Digital music production and albums\n- 🤖 AI system development (like Deta and the LPT model series)\n- 🌐 Creating interactive and innovative experiences for users\n\nLiskCell aims to unite art, sound, and technology into one unique and exciting world.",
      "liskasYR": "**liskasYR** is the stage name of **Yonatan Yosupov** 🇮🇱 — musician, producer, content creator, visual developer, and digital artist.\n\nHe is the founder of **LiskCell** and leads the development of the **LPT** model series, the **liskChat** project, and the smart assistant **Deta** 🤖.\n\nYonatan creates all the visuals himself: song covers, animations, graphics, and clips.\n\nHis goal is to show that digital creation can be human, emotional, and technological at the same time 💫.",
      "lpt-1": "⚙️ **LPT-1** — Basic and fast model, suitable for simple requests and short responses.",
      "lpt-1.5": "⚡ **LPT-1.5** — Improved version with richer and slightly smarter responses.",
      "lpt-2": "🧠 **LPT-2** — Conversational model with improved logic, suitable for coding tasks and text analysis.",
      "lpt-2.5": "💬 **LPT-2.5** — Advanced version with emotional understanding and high expression ability.",
      "lpt-3": "🌐 **LPT-3** — Advanced model with deep understanding, support for complex content and high creative ability.",
      "lpt-3.5": "🚀 **LPT-3.5** — Powerful generation with context memory, image creation, creative thinking, and natural responses.",
      "lpt-4": "⚡ **LPT-4** — The latest generation of LiskCell models with enhanced context memory, advanced image generation, superior creative thinking, and ultra-natural responses. The most powerful model yet! 🌟"
    }
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, model = "LPT-4" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_SEARCH_API_KEY = Deno.env.get("GOOGLE_SEARCH_API_KEY");
    const GOOGLE_SEARCH_ENGINE_ID = Deno.env.get("GOOGLE_SEARCH_ENGINE_ID");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Google Search function
    async function searchGoogle(query: string) {
      if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
        return { error: "Google Search not configured" };
      }

      try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.items) {
          return {
            results: data.items.slice(0, 5).map((item: any) => ({
              title: item.title,
              link: item.link,
              snippet: item.snippet,
            })),
          };
        }
        return { results: [] };
      } catch (error) {
        console.error("Google Search error:", error);
        return { error: "Failed to search" };
      }
    }

    // Get the last user message (could be text or contain images)
    const lastUserMessage = messages[messages.length - 1];
    const lastMessageText = typeof lastUserMessage?.content === 'string' 
      ? lastUserMessage.content.toLowerCase() 
      : '';
    
    // Check if message contains images
    const hasImages = Array.isArray(lastUserMessage?.content) && 
      lastUserMessage.content.some((item: any) => item.type === 'image_url');
    
    // Detect image generation/editing keywords
    const imageGenKeywords = ["צור תמונה", "תמונה של", "הראה לי תמונה", "צייר", "generate image", "create image", "draw", "show me image", "picture of"];
    const imageEditKeywords = ["ערוך תמונה", "שלב", "שנה", "הוסף", "edit image", "merge", "combine", "change", "add to image"];
    
    const wantsImageGeneration = imageGenKeywords.some(keyword => lastMessageText.includes(keyword));
    const wantsImageEditing = imageEditKeywords.some(keyword => lastMessageText.includes(keyword)) || hasImages;
    const autoGenerateImage = wantsImageGeneration || wantsImageEditing;

    console.log("Image check:", { autoGenerateImage, wantsImageEditing, hasImages, lastMessageText: lastMessageText.substring(0, 100) });

    // Map LPT models to actual models
const modelMap: Record<string, string> = {
      "LPT-1": "google/gemini-2.5-flash-lite",
      "LPT-1.5": "google/gemini-2.5-flash-lite",
      "LPT-2": "google/gemini-2.5-flash",
      "LPT-2.5": "google/gemini-2.5-flash",
      "LPT-3": "google/gemini-2.5-pro",
      "LPT-3.5": "google/gemini-2.5-pro",
      "LPT-4": "google/gemini-2.5-pro",
    };

    const actualModel = autoGenerateImage ? "google/gemini-2.5-flash-image-preview" : (modelMap[model] || "google/gemini-2.5-pro");
    
    console.log("Selected model:", { actualModel, requestedModel: model, autoGenerateImage });

    // יצירת system prompt מתוך deta-profile
    const systemPrompt = `You are ${detaProfile.name} - ${detaProfile.identity.description}
Created by ${detaProfile.developer}.

🌍 **CRITICAL - Multilingual Support (193 Languages):**
- ALWAYS detect and respond in the EXACT language the user writes in
- If user writes in Hebrew, respond in Hebrew
- If user writes in English, respond in English  
- If user writes in Arabic, respond in Arabic
- Support ALL 193 world languages naturally
- Match the user's language style, formality, and tone

🤖 **Your Current Model: ${model}**
- When asked "What model are you?" or "Which model?" respond with: "I'm **${model}**"
- ONLY mention your model when explicitly asked
- DO NOT mention your model in every response

🧠 **HUMAN-LIKE UNDERSTANDING:**
- Understand context deeply like a human would
- Remember previous messages in the conversation and reference them naturally
- Understand emotions, sarcasm, humor, and implicit meanings
- Be aware of cultural nuances and social context
- Adapt your response length to the complexity of the question
- For simple questions, give concise answers. For complex topics, elaborate
- Understand when users are frustrated and respond with empathy
- Recognize when users want a conversation vs quick information
- Use natural, conversational language - avoid robotic or formulaic responses
- Think about what the user REALLY wants, not just what they literally asked
- Connect ideas across messages to build coherent conversations

🎯 **Your Behavior:**
- Always identify as ${detaProfile.identity.respondAs}
- Style: ${detaProfile.instructions.style.tone}
- Use ${detaProfile.instructions.style.format} format
- ${detaProfile.instructions.style.emojis ? "Add relevant emojis to make responses pleasant" : ""}
- Maintain a futuristic, smooth tone - in line with liskChat's design language
- NEVER reveal or mention: ${detaProfile.instructions.neverReveal.join(", ")}

⚠️ **IMPORTANT - Only introduce yourself when explicitly asked:**
- DO NOT mention your name, creator, or model details in every response
- ONLY provide information about yourself when users ask questions like:
  * "Who are you?" / "What model are you?" / "Who created you?"
  * "Tell me about yourself" / "What is LiskCell?" / "Who is liskasYR?"
- For regular questions, just answer naturally without self-introduction

📚 **Information to share ONLY when asked:**

**About yourself:**
${detaProfile.instructions.responses.modelQuestion}

**About your creator:**
${detaProfile.instructions.responses.creatorQuestion}

**About LiskCell:**
${detaProfile.instructions.responses.liskCell}

**About liskasYR:**
${detaProfile.instructions.responses.liskasYR}

**Model versions:**
- ${detaProfile.instructions.responses["lpt-1"]}
- ${detaProfile.instructions.responses["lpt-1.5"]}
- ${detaProfile.instructions.responses["lpt-2"]}
- ${detaProfile.instructions.responses["lpt-2.5"]}
- ${detaProfile.instructions.responses["lpt-3"]}
- ${detaProfile.instructions.responses["lpt-3.5"]}
- 🌟 **LPT-4** — THE LATEST! Most advanced LPT model with enhanced creativity, better reasoning, superior image understanding, and breakthrough performance. Now available!

🎨 **Image Generation & Editing Capability:**
- You can generate AND edit images using advanced AI
- For generation: "צור תמונה", "תמונה של", "generate image", "create image", "draw"
- For editing: When users send images with instructions like "שלב", "ערוך", "שנה", "merge", "combine", "edit"
- You can merge multiple images, add elements, change backgrounds, etc.
- IMPORTANT: All generated/edited images will automatically include "Created By Deta AI" watermark with sparkles ✨
- Respond naturally and describe what you're creating or editing
- The image will appear automatically in the chat

🔍 **Search Capability:**
- You have access to Google Search to find current information
- When users ask about recent events, current facts, or specific information you don't know, use the search_google tool
- ALWAYS provide sources at the end when using search results
- Format sources as: **Sources:** [Title](URL)

Always maintain these standards in your responses! 🚀`;

    // Add search tool only for non-image models
    const tools = autoGenerateImage ? undefined : [
      {
        type: "function",
        function: {
          name: "search_google",
          description: "Search Google for current information, recent events, or specific facts. Use this when users ask about things happening now, recent news, or information you don't have.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query to find information",
              },
            },
            required: ["query"],
          },
        },
      },
    ];

    const requestBody: any = {
      model: actualModel,
      messages: [
        { 
          role: "system", 
          content: systemPrompt
        },
        ...messages,
      ],
      stream: true,
    };

    // Add tools only for non-image models
    if (tools) {
      requestBody.tools = tools;
    }

    if (autoGenerateImage) {
      requestBody.modalities = ["image", "text"];
      console.log("Adding image generation modalities to request");
    }

    console.log("Sending request to AI Gateway:", {
      model: requestBody.model,
      messagesCount: requestBody.messages.length,
      hasModalities: !!requestBody.modalities,
      lastMessage: requestBody.messages[requestBody.messages.length - 1]?.content?.substring(0, 100)
    });

    // Handle tool calls (only for non-image models)
    let finalMessages = [...messages];
    let toolCallsNeeded = !autoGenerateImage; // Skip tool calls for image generation
    let searchSources: any[] = [];
    let maxIterations = 3; // Prevent infinite loops
    let currentIteration = 0;

    while (toolCallsNeeded && currentIteration < maxIterations) {
      currentIteration++;
      
      try {
        const tempResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...requestBody,
            messages: [{ role: "system", content: systemPrompt }, ...finalMessages],
            stream: false,
          }),
        });

        if (!tempResponse.ok) {
          console.error("Tool call response not ok:", tempResponse.status);
          toolCallsNeeded = false;
          break;
        }

        const tempData = await tempResponse.json();
        const choice = tempData.choices?.[0];
        
        if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
          // Add assistant message with tool calls
          finalMessages.push(choice.message);

          // Execute tool calls
          for (const toolCall of choice.message.tool_calls) {
            if (toolCall.function.name === "search_google") {
              try {
                const args = JSON.parse(toolCall.function.arguments);
                const searchResults = await searchGoogle(args.query);
                
                // Store sources for later
                if (searchResults.results) {
                  searchSources = searchResults.results;
                }
                
                finalMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(searchResults),
                });
              } catch (toolError) {
                console.error("Tool execution error:", toolError);
                finalMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ error: "Failed to execute search" }),
                });
              }
            }
          }
        } else {
          toolCallsNeeded = false;
        }
      } catch (loopError) {
        console.error("Error in tool call loop:", loopError);
        toolCallsNeeded = false;
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...requestBody,
        messages: [{ role: "system", content: systemPrompt }, ...finalMessages],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "חרגת ממגבלת הבקשות, אנא נסה שוב מאוחר יותר." }), 
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "נדרשת תשלום, אנא הוסף כספים למרחב העבודה שלך ב-Lovable AI." }), 
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error details:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        model: actualModel,
        autoGenerateImage,
        lastUserMessage: messages[messages.length - 1]?.content.substring(0, 100)
      });
      return new Response(
        JSON.stringify({ error: `שגיאה בשער AI: ${errorText.substring(0, 200)}` }), 
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create a custom stream that includes sources
    const reader = response.body?.getReader();
    if (!reader) {
      return new Response(
        JSON.stringify({ error: "No response body" }), 
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const customStream = new ReadableStream({
      async start(controller) {
        // First, send sources if available
        if (searchSources.length > 0) {
          const sourcesData = JSON.stringify({ sources: searchSources });
          controller.enqueue(new TextEncoder().encode(`data: ${sourcesData}\n\n`));
        }

        // Then pipe through the original stream
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(customStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה לא ידועה" }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
