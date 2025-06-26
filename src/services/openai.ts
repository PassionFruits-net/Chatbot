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
}

export async function* streamChat(params: ChatMessage) {
  const systemPrompt = `You are an assistant for CUSTOMER ${params.customerId}. Answer ONLY with the information inside <docs></docs>. If the answer isn't there, reply "I don't have that information". Do NOT include any citations or source references in your response - the sources will be shown separately.`;
  
  const userPrompt = `${params.message}
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