import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { EVA_SYSTEM_PROMPT } from '@/lib/eva-prompt';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json();

    // Build conversation history for Claude
    const apiMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    // Add context about pending approvals, avoidance items, etc.
    let systemPrompt = EVA_SYSTEM_PROMPT;
    if (context) {
      systemPrompt += `\n\n## CURRENT STATE\n${context}`;
    }

    // Add instruction for conversational (not report) style
    systemPrompt += `\n\n## THIS INTERACTION
Remember: you are SPEAKING, not writing a report. Keep each response to 2-4 short sentences. One thought at a time. Wait for Chef's response before moving to the next topic. If you have multiple things to cover, say how many upfront ("Three things, Chef.") then deliver them one at a time across the conversation.

If Chef says something unclear or ambiguous, ask immediately. Don't guess. "Chef, not sure I caught that — you mean the Studio or the Pro?"

If Chef approves an action, confirm briefly and move on: "Done. Next thing."`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000, // Keep responses SHORT — this is dialogue
      system: systemPrompt,
      messages: apiMessages,
      tools: [
        {
          type: 'web_search_20250305' as any,
          name: 'web_search',
        },
      ],
    });

    // Extract text from response
    const text = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n\n');

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('EVA brain error:', error);
    return NextResponse.json(
      { text: "Chef, having a bit of trouble connecting right now. Give me a tick and try again." },
      { status: 500 }
    );
  }
}
