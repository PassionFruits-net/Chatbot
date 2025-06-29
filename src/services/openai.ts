import OpenAI from 'openai';
import dotenv from 'dotenv';
import { encode } from 'gpt-3-encoder';
import { estimateChatCost, trackUsage } from './cost-tracker';
import db from '../utils/db';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ChatMessage {
  customerId: string;
  message: string;
  chunks: Array<{ text: string; fileName: string }>;
  includeGeneralAI?: boolean;
  explanationComplexity?: string;
}

export async function* streamChat(params: ChatMessage) {
  const includeGeneralAI = params.includeGeneralAI || false;
  const explanationComplexity = params.explanationComplexity || 'advanced';
  
  // Create complexity-specific formatting instructions
  const complexityInstructions = explanationComplexity === 'simple' 
    ? `

**IMPORTANT FORMATTING REQUIREMENTS:**
- Use simple language suitable for a 14-year-old reading level
- Break text into short paragraphs (2-3 sentences each)
- Use **bold text** to highlight key points
- Include relevant emojis for visual effect (📚 for learning, 💡 for ideas, ⚠️ for warnings, etc.)
- Explain technical terms in simple words
- Use bullet points or numbered lists when helpful
- Keep sentences short and clear`
    : `

**IMPORTANT FORMATTING REQUIREMENTS:**
- Structure your response with clear paragraphs
- Use **bold text** to emphasize important concepts and key terms
- Include relevant emojis to enhance readability (📊 for data, 🔧 for technical, 💡 for insights, etc.)
- Use bullet points or numbered lists for clarity when appropriate
- Maintain professional but engaging tone`;

  // Get customer's custom system prompt
  const customerRow = db.prepare('SELECT systemPrompt FROM customers WHERE customerId = ?').get(params.customerId) as { systemPrompt: string | null } | undefined;
  const customSystemPrompt = customerRow?.systemPrompt;
  
  let basePrompt;
  if (customSystemPrompt) {
    // Use custom system prompt with document context
    basePrompt = includeGeneralAI 
      ? `${customSystemPrompt} You can use both the information from <docs></docs> (customer's documents) and your general knowledge to provide comprehensive answers. Prioritize customer documents when they contain relevant information, but supplement with your general knowledge when needed. Do NOT include citations in your response - the sources will be shown separately.`
      : `${customSystemPrompt} Answer ONLY with the information inside <docs></docs>. If the answer isn't there, reply "I don't have that information". Do NOT include any citations or source references in your response - the sources will be shown separately.`;
  } else {
    // Use default system prompt
    basePrompt = includeGeneralAI 
      ? `You are an assistant for CUSTOMER ${params.customerId}. You can use both the information from <docs></docs> (customer's documents) and your general knowledge to provide comprehensive answers. Prioritize customer documents when they contain relevant information, but supplement with your general knowledge when needed. Do NOT include citations in your response - the sources will be shown separately.`
      : `You are an assistant for CUSTOMER ${params.customerId}. Answer ONLY with the information inside <docs></docs>. If the answer isn't there, reply "I don't have that information". Do NOT include any citations or source references in your response - the sources will be shown separately.`;
  }
  
  const systemPrompt = basePrompt + complexityInstructions;
  
  let userPrompt = `${params.message}
<docs>
${params.chunks.map(chunk => `[${chunk.fileName}]\n${chunk.text}`).join('\n\n')}
</docs>`;

  const inputTokens = encode(systemPrompt).length + encode(userPrompt).length;
  let outputTokens = 0;
  let responseText = '';

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 512,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      responseText += delta;
      yield delta;
    }
  }

  // Calculate output tokens and track usage
  outputTokens = encode(responseText).length;
  const estimatedCost = estimateChatCost(inputTokens, outputTokens);

  trackUsage({
    customerId: params.customerId,
    operation: 'chat',
    model: 'gpt-4o-mini',
    inputTokens,
    outputTokens,
    estimatedCost,
    metadata: `Query: ${params.message.substring(0, 50)}...`
  });
}