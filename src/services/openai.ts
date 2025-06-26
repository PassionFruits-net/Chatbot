import OpenAI from 'openai';
import dotenv from 'dotenv';
import { encode } from 'gpt-3-encoder';
import { estimateChatCost, trackUsage } from './cost-tracker';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ChatMessage {
  customerId: string;
  message: string;
  chunks: Array<{ text: string; fileName: string }>;
  includeGeneralAI?: boolean;
}

export async function* streamChat(params: ChatMessage) {
  const includeGeneralAI = params.includeGeneralAI || false;
  
  const systemPrompt = includeGeneralAI 
    ? `You are an assistant for CUSTOMER ${params.customerId}. You can use both the information from <docs></docs> (customer's documents) and your general knowledge to provide comprehensive answers. Prioritize customer documents when they contain relevant information, but supplement with your general knowledge when needed. Do NOT include citations in your response - the sources will be shown separately.`
    : `You are an assistant for CUSTOMER ${params.customerId}. Answer ONLY with the information inside <docs></docs>. If the answer isn't there, reply "I don't have that information". Do NOT include any citations or source references in your response - the sources will be shown separately.`;
  
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