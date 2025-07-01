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

// Simple language detection based on common words and patterns
function detectLanguage(text: string): 'norwegian' | 'english' {
  const normalizedText = text.toLowerCase();
  
  // Norwegian indicators (common words and patterns)
  const norwegianIndicators = [
    'hva', 'hvem', 'hvor', 'når', 'hvorfor', 'hvordan', 'kan', 'vil', 'skal', 'må',
    'jeg', 'du', 'han', 'hun', 'vi', 'dere', 'de', 'seg', 'min', 'din', 'sin',
    'og', 'eller', 'men', 'for', 'til', 'av', 'med', 'på', 'i', 'om', 'under',
    'forsikring', 'reise', 'bil', 'hus', 'hjem', 'dekker', 'vilkår', 'skade',
    'ø', 'å', 'æ' // Norwegian characters
  ];
  
  // English indicators
  const englishIndicators = [
    'what', 'who', 'where', 'when', 'why', 'how', 'can', 'will', 'shall', 'must',
    'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our',
    'and', 'or', 'but', 'for', 'to', 'of', 'with', 'on', 'in', 'about', 'under',
    'insurance', 'travel', 'car', 'house', 'home', 'covers', 'terms', 'claim',
    'the', 'this', 'that', 'these', 'those'
  ];
  
  let norwegianScore = 0;
  let englishScore = 0;
  
  // Check for Norwegian indicators
  for (const indicator of norwegianIndicators) {
    if (normalizedText.includes(indicator)) {
      norwegianScore += indicator.length === 1 ? 2 : 1; // Give more weight to Norwegian characters
    }
  }
  
  // Check for English indicators
  for (const indicator of englishIndicators) {
    if (normalizedText.includes(indicator)) {
      englishScore += 1;
    }
  }
  
  // Default to Norwegian for NorskForsikring if unclear
  return norwegianScore >= englishScore ? 'norwegian' : 'english';
}

export async function* streamChat(params: ChatMessage) {
  const includeGeneralAI = params.includeGeneralAI || false;
  const explanationComplexity = params.explanationComplexity || 'advanced';
  
  // Detect the language of the user's message
  const detectedLanguage = detectLanguage(params.message);
  
  // Create complexity-specific formatting instructions (language-aware)
  const isNorwegian = detectedLanguage === 'norwegian' || params.customerId === 'NorskForsikring';
  
  const complexityInstructions = explanationComplexity === 'simple' 
    ? `

**VIKTIGE FORMATERING KRAV${isNorwegian ? '' : ' / IMPORTANT FORMATTING REQUIREMENTS'}:**
${isNorwegian ? `
- Bruk enkelt språk som passer for en 14-åring
- Del teksten inn i korte avsnitt (2-3 setninger hver)
- Bruk **fet tekst** for å fremheve nøkkelpunkter
- Inkluder relevante emojis for visuell effekt (📚 for læring, 💡 for ideer, ⚠️ for advarsler, osv.)
- Forklar fagbegreper med enkle ord
- Bruk punktlister eller nummererte lister når det er nyttig
- Hold setningene korte og klare` : `
- Use simple language suitable for a 14-year-old reading level
- Break text into short paragraphs (2-3 sentences each)
- Use **bold text** to highlight key points
- Include relevant emojis for visual effect (📚 for learning, 💡 for ideas, ⚠️ for warnings, etc.)
- Explain technical terms in simple words
- Use bullet points or numbered lists when helpful
- Keep sentences short and clear`}`
    : `

**VIKTIGE FORMATERING KRAV${isNorwegian ? '' : ' / IMPORTANT FORMATTING REQUIREMENTS'}:**
${isNorwegian ? `
- Strukturer svaret ditt med klare avsnitt
- Bruk **fet tekst** for å fremheve viktige konsepter og nøkkelord
- Inkluder relevante emojis for å forbedre lesbarheten (📊 for data, 🔧 for teknisk, 💡 for innsikt, osv.)
- Bruk punktlister eller nummererte lister for klarhet når det er hensiktsmessig
- Oppretthold en profesjonell men engasjerende tone` : `
- Structure your response with clear paragraphs
- Use **bold text** to emphasize important concepts and key terms
- Include relevant emojis to enhance readability (📊 for data, 🔧 for technical, 💡 for insights, etc.)
- Use bullet points or numbered lists for clarity when appropriate
- Maintain professional but engaging tone`}`;

  // Get customer's custom system prompt
  const customerRow = db.prepare('SELECT systemPrompt FROM customers WHERE customerId = ?').get(params.customerId) as { systemPrompt: string | null } | undefined;
  const customSystemPrompt = customerRow?.systemPrompt;
  
  // Create language-specific instruction
  const languageInstruction = detectedLanguage === 'english' 
    ? `\n\nIMPORTANT: The user asked in English, so respond in English.`
    : params.customerId === 'NorskForsikring' 
      ? `\n\nIMPORTANT: Respond in Norwegian (norsk) as this is for Norwegian customers.`
      : '';

  let basePrompt;
  if (customSystemPrompt) {
    // Use custom system prompt - don't add English instructions if prompt is in Norwegian
    const isNorwegianPrompt = customSystemPrompt.includes('norsk') || customSystemPrompt.includes('Du er');
    if (isNorwegianPrompt) {
      // For Norwegian prompts, don't add English document instructions
      basePrompt = customSystemPrompt + languageInstruction;
    } else {
      // For other prompts, add document context in English
      basePrompt = includeGeneralAI 
        ? `${customSystemPrompt}${languageInstruction} You can use both the information from <docs></docs> (customer's documents) and your general knowledge to provide comprehensive answers. Prioritize customer documents when they contain relevant information, but supplement with your general knowledge when needed. Do NOT include citations in your response - the sources will be shown separately.`
        : `${customSystemPrompt}${languageInstruction} Answer ONLY with the information inside <docs></docs>. If the answer isn't there, reply "I don't have that information". Do NOT include any citations or source references in your response - the sources will be shown separately.`;
    }
  } else {
    // Use default system prompt
    basePrompt = includeGeneralAI 
      ? `You are an assistant for CUSTOMER ${params.customerId}.${languageInstruction} You can use both the information from <docs></docs> (customer's documents) and your general knowledge to provide comprehensive answers. Prioritize customer documents when they contain relevant information, but supplement with your general knowledge when needed. Do NOT include citations in your response - the sources will be shown separately.`
      : `You are an assistant for CUSTOMER ${params.customerId}.${languageInstruction} Answer ONLY with the information inside <docs></docs>. If the answer isn't there, reply "I don't have that information". Do NOT include any citations or source references in your response - the sources will be shown separately.`;
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