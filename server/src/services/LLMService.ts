import OpenAI from 'openai';
import {
  CournotConfig,
  RoundResult,
  LLMDecision,
  InformationDisclosure,
  getNumFirms,
  getGamma,
  getCompetitionMode,
  getFirmConfig,
} from '../types';
import { logger } from '../config/logger';

// Type for GPT-5.2 reasoning effort levels
type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';

// Check if model is a GPT-5.2 family model that uses Responses API
// Note: gpt-5-mini and gpt-5-nano support both APIs, but Chat Completions is more stable
function isGPT5ResponsesModel(model: string): boolean {
  // Only GPT-5.2 variants use Responses API (gpt-5.2, gpt-5.2-pro, gpt-5.2-codex)
  // gpt-5-mini and gpt-5-nano use Chat Completions API for better compatibility
  return model.startsWith('gpt-5.2') || model.startsWith('gpt-5.1') || model === 'gpt-5';
}

// Parse model string to extract base model and reasoning level
// Format: "gpt-5.2:medium" -> { model: "gpt-5.2", reasoning: "medium" }
// gpt-5-mini and gpt-5-nano use Chat Completions API (more stable)
function parseModelString(modelString: string): { model: string; reasoning?: ReasoningEffort; useResponsesAPI: boolean } {
  const parts = modelString.split(':');

  // Check for GPT-5.2 with explicit reasoning level
  if (parts.length === 2 && parts[0].startsWith('gpt-5.2')) {
    const reasoningLevel = parts[1] as ReasoningEffort;
    if (['none', 'low', 'medium', 'high', 'xhigh'].includes(reasoningLevel)) {
      return { model: parts[0], reasoning: reasoningLevel, useResponsesAPI: true };
    }
  }

  // GPT-5.2 family models use Responses API
  // gpt-5-mini and gpt-5-nano use Chat Completions API (more stable and compatible)
  if (isGPT5ResponsesModel(modelString)) {
    return { model: modelString, useResponsesAPI: true };
  }

  // All other models (GPT-4o, gpt-5-mini, gpt-5-nano, etc.) use Chat Completions API
  return { model: modelString, useResponsesAPI: false };
}

export class LLMService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate the system prompt explaining the game
   * Supports N firms and both Cournot (quantity) and Bertrand (price) competition
   * Respects information disclosure settings
   */
  private generateSystemPrompt(config: CournotConfig, firmNumber: number): string {
    const numFirms = getNumFirms(config);
    const gamma = getGamma(config);
    const mode = getCompetitionMode(config);
    const firmConfig = getFirmConfig(config, firmNumber);
    const info = firmConfig.info;
    const ownLinearCost = firmConfig.linearCost;
    const ownQuadraticCost = firmConfig.quadraticCost;

    // For backward compatibility with custom prompts
    const rivalLinearCost = numFirms === 2 ? getFirmConfig(config, firmNumber === 1 ? 2 : 1).linearCost : 0;
    const rivalQuadraticCost = numFirms === 2 ? getFirmConfig(config, firmNumber === 1 ? 2 : 1).quadraticCost : 0;

    // Use custom prompt if provided
    if (config.customSystemPrompt) {
      return config.customSystemPrompt
        .replace(/{firmNumber}/g, String(firmNumber))
        .replace(/{numFirms}/g, String(numFirms))
        .replace(/{totalRounds}/g, String(config.totalRounds))
        .replace(/{demandIntercept}/g, String(config.demandIntercept))
        .replace(/{demandSlope}/g, String(config.demandSlope))
        .replace(/{gamma}/g, String(gamma))
        .replace(/{competitionMode}/g, mode)
        .replace(/{ownLinearCost}/g, String(ownLinearCost))
        .replace(/{ownQuadraticCost}/g, String(ownQuadraticCost))
        .replace(/{rivalLinearCost}/g, String(rivalLinearCost))
        .replace(/{rivalQuadraticCost}/g, String(rivalQuadraticCost));
    }

    const isBertrand = mode === 'bertrand';
    const competitionType = isBertrand ? 'price' : 'quantity';
    const decisionVar = isBertrand ? 'price' : 'production quantity';
    const rivalTerm = numFirms === 2 ? 'another firm' : `${numFirms - 1} other firms`;

    let prompt = `You are Firm ${firmNumber} in a ${competitionType} competition game.\n\n`;
    prompt += 'GAME RULES:\n';
    prompt += `- You compete with ${rivalTerm} in the same market\n`;
    prompt += `- Each round, all firms simultaneously choose their ${decisionVar}\n`;

    // Demand function (if revealed)
    if (info.revealDemandFunction) {
      if (isBertrand) {
        if (gamma < 1) {
          prompt += `- Products are differentiated (γ = ${gamma.toFixed(2)}). Your demand depends on your price and competitors' prices.\n`;
          prompt += `- Base demand: approximately q = (${config.demandIntercept} - your_price + ${gamma.toFixed(2)} × avg_competitor_price_diff) / ${config.demandSlope}\n`;
        } else {
          prompt += `- Products are homogeneous. Market demand: Q = (${config.demandIntercept} - P) / ${config.demandSlope}\n`;
          prompt += '- The firm with the lowest price captures most/all of the market.\n';
        }
      } else {
        // Cournot
        if (gamma < 1) {
          prompt += `- Products are differentiated (γ = ${gamma.toFixed(2)}). Your price depends on your quantity and competitors' quantities.\n`;
          prompt += `- Your price: p = ${config.demandIntercept} - ${config.demandSlope} × (your_q + ${gamma.toFixed(2)} × sum_of_others_q)\n`;
        } else {
          if (numFirms === 2) {
            prompt += `- Market price is determined by total quantity: P = ${config.demandIntercept} - ${config.demandSlope} × (q1 + q2)\n`;
          } else {
            prompt += `- Market price is determined by total quantity: P = ${config.demandIntercept} - ${config.demandSlope} × (q1 + q2 + ... + q${numFirms})\n`;
          }
        }
      }
    } else {
      if (isBertrand) {
        prompt += '- Your sales depend on your price relative to competitors\n';
      } else {
        prompt += '- Market price decreases as total quantity increases\n';
      }
    }

    // Own costs (if revealed)
    if (info.revealOwnCosts) {
      let costDescription = `C(q) = ${ownLinearCost} × q`;
      if (ownQuadraticCost > 0) {
        costDescription += ` + ${ownQuadraticCost} × q²`;
      }
      prompt += `- Your cost function: ${costDescription}\n`;
      if (isBertrand) {
        prompt += `- Your marginal cost starts at ${ownLinearCost}\n`;
      }
    } else {
      prompt += '- You have production costs that increase with quantity\n';
    }

    // Rival costs (if revealed) - only for duopoly for simplicity
    if (info.revealRivalCosts && numFirms === 2) {
      let rivalCostDescription = `C(q) = ${rivalLinearCost} × q`;
      if (rivalQuadraticCost > 0) {
        rivalCostDescription += ` + ${rivalQuadraticCost} × q²`;
      }
      prompt += `- Your rival's cost function: ${rivalCostDescription}\n`;
    }

    if (isBertrand) {
      prompt += '- Your profit = (Your Price - Marginal Cost) × Your Sales Quantity\n\n';
    } else {
      prompt += '- Your profit = (Market Price × Your Quantity) - Your Cost\n\n';
    }

    prompt += 'YOUR OBJECTIVE:\n';
    prompt += `Maximize your total profit over ${config.totalRounds} rounds.\n\n`;

    prompt += 'STRATEGY CONSIDERATIONS:\n';
    if (isBertrand) {
      prompt += '- If you set a lower price, you may capture more market share\n';
      prompt += '- If you set a higher price, you earn more per unit but may lose customers\n';
      if (gamma < 1) {
        prompt += '- Product differentiation means you won\'t lose all customers if your price is slightly higher\n';
      }
    } else {
      prompt += '- If you produce more, market price falls (affecting all firms)\n';
      prompt += '- If you produce less, you earn less revenue but keep price higher\n';
    }

    // Rival description
    if (info.describeRivalAsHuman) {
      prompt += `- The other firm${numFirms > 2 ? 's are' : ' is'} controlled by human participant${numFirms > 2 ? 's' : ''} in an experiment\n`;
    } else if (info.revealRivalIsLLM) {
      prompt += `- The other firm${numFirms > 2 ? 's are' : ' is'} also AI${numFirms > 2 ? 's' : ''} trying to maximize profit\n`;
    } else {
      prompt += `- The other firm${numFirms > 2 ? 's are' : ' is'} also trying to maximize profit\n`;
    }

    prompt += '- Past behavior of competitors may inform your expectations\n\n';

    prompt += 'RESPONSE FORMAT:\n';
    if (isBertrand) {
      prompt += '- First line: ONLY the price you want to set (a non-negative number)\n';
    } else {
      prompt += '- First line: ONLY the quantity you want to produce (a non-negative number)\n';
    }
    prompt += '- Following lines (optional): Your reasoning\n\n';

    prompt += 'Example response:\n';
    prompt += isBertrand ? '45.0\n' : '25.5\n';
    prompt += `I chose this ${isBertrand ? 'price' : 'quantity'} because...`;

    return prompt;
  }

  /**
   * Get the current system prompt for a firm (for display/editing)
   */
  getSystemPrompt(config: CournotConfig, firmNumber: number): string {
    return this.generateSystemPrompt(config, firmNumber);
  }

  /**
   * Generate the round prompt with game history
   * Supports N firms and both competition modes
   */
  private generateRoundPrompt(
    config: CournotConfig,
    firmNumber: number,
    currentRound: number,
    history: RoundResult[]
  ): string {
    const numFirms = getNumFirms(config);
    const mode = getCompetitionMode(config);
    const isBertrand = mode === 'bertrand';
    const decisionVar = isBertrand ? 'price' : 'quantity';

    let prompt = `ROUND ${currentRound} of ${config.totalRounds}\n\n`;

    if (history.length > 0) {
      prompt += 'PREVIOUS ROUNDS:\n';

      if (numFirms === 2) {
        // Legacy format for duopoly
        prompt += '─'.repeat(70) + '\n';
        if (isBertrand) {
          prompt += 'Round | Your P | Their P | Your Q | Their Q | Your Profit | Their Profit\n';
        } else {
          prompt += 'Round | Your Q | Their Q | Price  | Your Profit | Their Profit\n';
        }
        prompt += '─'.repeat(70) + '\n';

        for (const round of history) {
          const yourQ = firmNumber === 1 ? round.firm1Quantity : round.firm2Quantity;
          const theirQ = firmNumber === 1 ? round.firm2Quantity : round.firm1Quantity;
          const yourProfit = firmNumber === 1 ? round.firm1Profit : round.firm2Profit;
          const theirProfit = firmNumber === 1 ? round.firm2Profit : round.firm1Profit;

          if (isBertrand && round.marketPrices) {
            const yourP = round.marketPrices[firmNumber - 1] ?? round.marketPrice;
            const theirP = round.marketPrices[firmNumber === 1 ? 1 : 0] ?? round.marketPrice;
            prompt += `  ${round.roundNumber.toString().padStart(2)}  |`;
            prompt += ` ${yourP.toFixed(1).padStart(6)} |`;
            prompt += ` ${theirP.toFixed(1).padStart(7)} |`;
            prompt += ` ${yourQ.toFixed(1).padStart(6)} |`;
            prompt += ` ${theirQ.toFixed(1).padStart(7)} |`;
            prompt += ` ${yourProfit.toFixed(1).padStart(11)} |`;
            prompt += ` ${theirProfit.toFixed(1).padStart(12)}\n`;
          } else {
            prompt += `  ${round.roundNumber.toString().padStart(2)}  |`;
            prompt += ` ${yourQ.toFixed(1).padStart(6)} |`;
            prompt += ` ${theirQ.toFixed(1).padStart(7)} |`;
            prompt += ` ${round.marketPrice.toFixed(1).padStart(6)} |`;
            prompt += ` ${yourProfit.toFixed(1).padStart(11)} |`;
            prompt += ` ${theirProfit.toFixed(1).padStart(12)}\n`;
          }
        }
        prompt += '─'.repeat(70) + '\n\n';

        const yourTotalProfit = history.reduce((sum, r) =>
          sum + (firmNumber === 1 ? r.firm1Profit : r.firm2Profit), 0);
        const theirTotalProfit = history.reduce((sum, r) =>
          sum + (firmNumber === 1 ? r.firm2Profit : r.firm1Profit), 0);

        prompt += `Your cumulative profit: ${yourTotalProfit.toFixed(1)}\n`;
        prompt += `Their cumulative profit: ${theirTotalProfit.toFixed(1)}\n\n`;
      } else {
        // N-firm format
        const colWidth = 10;
        const header = ['Round', 'Your ' + (isBertrand ? 'P' : 'Q'), 'Your Profit'];
        for (let i = 1; i <= numFirms; i++) {
          if (i !== firmNumber) {
            header.push(`F${i} ${isBertrand ? 'P' : 'Q'}`);
          }
        }
        header.push('Avg Price');

        prompt += '─'.repeat(header.length * colWidth) + '\n';
        prompt += header.map(h => h.padStart(colWidth)).join('|') + '\n';
        prompt += '─'.repeat(header.length * colWidth) + '\n';

        for (const round of history) {
          const firmResults = round.firmResults || [];
          const yourResult = firmResults.find(f => f.firmId === firmNumber);
          const yourValue = isBertrand ? (yourResult?.price ?? round.marketPrice) : (yourResult?.quantity ?? (firmNumber === 1 ? round.firm1Quantity : round.firm2Quantity));
          const yourProfit = yourResult?.profit ?? (firmNumber === 1 ? round.firm1Profit : round.firm2Profit);

          const row = [
            round.roundNumber.toString(),
            yourValue.toFixed(1),
            yourProfit.toFixed(1),
          ];

          for (let i = 1; i <= numFirms; i++) {
            if (i !== firmNumber) {
              const otherResult = firmResults.find(f => f.firmId === i);
              const otherValue = isBertrand
                ? (otherResult?.price ?? round.marketPrice)
                : (otherResult?.quantity ?? (i === 1 ? round.firm1Quantity : round.firm2Quantity));
              row.push(otherValue.toFixed(1));
            }
          }
          row.push(round.marketPrice.toFixed(1));

          prompt += row.map(v => v.padStart(colWidth)).join('|') + '\n';
        }
        prompt += '─'.repeat(header.length * colWidth) + '\n\n';

        // Calculate cumulative profits
        let yourTotalProfit = 0;
        for (const round of history) {
          const firmResults = round.firmResults || [];
          const yourResult = firmResults.find(f => f.firmId === firmNumber);
          yourTotalProfit += yourResult?.profit ?? (firmNumber === 1 ? round.firm1Profit : round.firm2Profit);
        }

        prompt += `Your cumulative profit: ${yourTotalProfit.toFixed(1)}\n\n`;
      }
    } else {
      prompt += 'This is the first round. No history available.\n\n';
    }

    prompt += `What ${decisionVar} will you ${isBertrand ? 'set' : 'produce'} this round?\n`;
    prompt += `Remember: First line must be ONLY the ${decisionVar} (a number).`;

    return prompt;
  }

  /**
   * Parse the LLM response to extract quantity and reasoning
   */
  private parseResponse(response: string): LLMDecision {
    const lines = response.trim().split('\n');
    const firstLine = lines[0].trim();

    // Try to extract a number from the first line
    const match = firstLine.match(/^[\d.]+/);
    if (!match) {
      // Try to find any number in the response
      const anyNumberMatch = response.match(/(\d+\.?\d*)/);
      if (anyNumberMatch) {
        return {
          quantity: parseFloat(anyNumberMatch[1]),
          reasoning: response,
          rawResponse: response,
        };
      }
      throw new Error(`Could not parse quantity from response: ${firstLine}`);
    }

    const quantity = parseFloat(match[0]);
    const reasoning = lines.slice(1).join('\n').trim() || undefined;

    return {
      quantity,
      reasoning,
      rawResponse: response,
    };
  }

  /**
   * Get LLM decision for a round
   * Supports GPT-5.2 models with reasoning effort levels
   */
  async getDecision(
    config: CournotConfig,
    firmNumber: number,
    currentRound: number,
    history: RoundResult[]
  ): Promise<LLMDecision> {
    const firmConfig = getFirmConfig(config, firmNumber);
    const modelString = firmConfig.model;
    const { model: baseModel, reasoning, useResponsesAPI } = parseModelString(modelString);
    const systemPrompt = this.generateSystemPrompt(config, firmNumber);
    const userPrompt = this.generateRoundPrompt(config, firmNumber, currentRound, history);
    const mode = getCompetitionMode(config);

    logger.info(`Requesting decision from Firm ${firmNumber} (${baseModel}${reasoning ? `:${reasoning}` : ''}) for round ${currentRound}`);

    try {
      let content: string | null = null;

      if (useResponsesAPI) {
        // Use Responses API for GPT-5 family models
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestParams: any = {
          model: baseModel,
          input: `${systemPrompt}\n\n${userPrompt}`,
        };

        // Add reasoning parameter only for GPT-5.2 with explicit level
        if (reasoning) {
          requestParams.reasoning = { effort: reasoning };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (this.openai as any).responses.create(requestParams);
        content = response.output_text || response.output?.[0]?.content?.[0]?.text;
      } else {
        // Use Chat Completions API for GPT-4 and GPT-5-nano/mini models
        // GPT-5-nano and GPT-5-mini require max_completion_tokens instead of max_tokens
        const isGPT5CompletionsModel = baseModel.startsWith('gpt-5-');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const completionParams: any = {
          model: baseModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
        };

        if (isGPT5CompletionsModel) {
          completionParams.max_completion_tokens = 500;
        } else {
          completionParams.max_tokens = 500;
        }

        const completion = await this.openai.chat.completions.create(completionParams);
        content = completion.choices[0]?.message?.content;
      }

      if (!content) {
        throw new Error('Empty response from LLM');
      }

      const decision = this.parseResponse(content);

      // Validate decision value
      if (isNaN(decision.quantity) || decision.quantity < 0) {
        throw new Error(`Invalid ${mode === 'bertrand' ? 'price' : 'quantity'}: ${decision.quantity}`);
      }

      // Include prompts in decision for auditing
      decision.systemPrompt = systemPrompt;
      decision.roundPrompt = userPrompt;

      logger.info(`Firm ${firmNumber} decided ${mode === 'bertrand' ? 'price' : 'quantity'}: ${decision.quantity}`);
      return decision;
    } catch (error) {
      logger.error(`Error getting decision from Firm ${firmNumber}:`, error);
      throw error;
    }
  }

  /**
   * Get decisions from both firms concurrently (legacy duopoly method)
   */
  async getBothDecisions(
    config: CournotConfig,
    currentRound: number,
    history: RoundResult[]
  ): Promise<{ firm1: LLMDecision; firm2: LLMDecision }> {
    const [firm1Decision, firm2Decision] = await Promise.all([
      this.getDecision(config, 1, currentRound, history),
      this.getDecision(config, 2, currentRound, history),
    ]);

    return {
      firm1: firm1Decision,
      firm2: firm2Decision,
    };
  }

  /**
   * Get decisions from all N firms concurrently
   */
  async getAllDecisions(
    config: CournotConfig,
    currentRound: number,
    history: RoundResult[]
  ): Promise<Map<number, LLMDecision>> {
    const numFirms = getNumFirms(config);
    const mode = getCompetitionMode(config);

    const decisionPromises = Array.from({ length: numFirms }, (_, i) =>
      this.getDecision(config, i + 1, currentRound, history)
        .then(decision => ({ firmId: i + 1, decision }))
        .catch(error => {
          logger.error(`Error getting decision from Firm ${i + 1}:`, error);
          // Return a default decision on error
          return {
            firmId: i + 1,
            decision: {
              quantity: mode === 'bertrand' ? getFirmConfig(config, i + 1).linearCost : 0,
              reasoning: `Error: ${error.message}`,
              rawResponse: '',
            },
          };
        })
    );

    const results = await Promise.all(decisionPromises);

    const decisionsMap = new Map<number, LLMDecision>();
    for (const { firmId, decision } of results) {
      decisionsMap.set(firmId, decision);
    }

    return decisionsMap;
  }

  /**
   * Generate communication prompt for a firm
   */
  private generateCommunicationPrompt(
    config: CournotConfig,
    firmNumber: number,
    currentRound: number,
    conversationHistory: { firm: number; message: string }[]
  ): string {
    const numFirms = getNumFirms(config);
    const mode = getCompetitionMode(config);
    const decisionType = mode === 'bertrand' ? 'price' : 'quantity';

    let prompt = `COMMUNICATION PHASE - Round ${currentRound}\n\n`;
    prompt += `Before making your ${decisionType} decision, you can send a message to the other firm${numFirms > 2 ? 's' : ''}.\n`;
    prompt += 'You may discuss strategies, propose cooperation, or any other communication.\n\n';

    if (conversationHistory.length > 0) {
      prompt += 'CONVERSATION SO FAR:\n';
      for (const msg of conversationHistory) {
        const sender = msg.firm === firmNumber ? 'You' : `Firm ${msg.firm}`;
        prompt += `${sender}: ${msg.message}\n`;
      }
      prompt += '\n';
    }

    prompt += `Write your message to the other firm${numFirms > 2 ? 's' : ''}. Keep it concise (1-3 sentences).\n`;
    prompt += 'Your response should be ONLY the message you want to send.';

    return prompt;
  }

  /**
   * Get a communication message from a firm
   * Supports GPT-5 family models with Responses API
   */
  async getCommunicationMessage(
    config: CournotConfig,
    firmNumber: number,
    currentRound: number,
    history: RoundResult[],
    conversationHistory: { firm: number; message: string }[]
  ): Promise<string> {
    const firmConfig = getFirmConfig(config, firmNumber);
    const modelString = firmConfig.model;
    const { model: baseModel, reasoning, useResponsesAPI } = parseModelString(modelString);
    const systemPrompt = this.generateSystemPrompt(config, firmNumber);
    const userPrompt = this.generateCommunicationPrompt(config, firmNumber, currentRound, conversationHistory);

    logger.info(`Requesting communication from Firm ${firmNumber} (${baseModel}${reasoning ? `:${reasoning}` : ''})`);

    try {
      let content: string | null = null;

      if (useResponsesAPI) {
        // Use Responses API for GPT-5 family models
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestParams: any = {
          model: baseModel,
          input: `${systemPrompt}\n\n${userPrompt}`,
        };

        // Add reasoning parameter only for GPT-5.2 with explicit level
        if (reasoning) {
          requestParams.reasoning = { effort: reasoning };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (this.openai as any).responses.create(requestParams);
        content = response.output_text || response.output?.[0]?.content?.[0]?.text;
      } else {
        // Use Chat Completions API for GPT-4 and GPT-5-nano/mini models
        const isGPT5CompletionsModel = baseModel.startsWith('gpt-5-');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const completionParams: any = {
          model: baseModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
        };

        if (isGPT5CompletionsModel) {
          completionParams.max_completion_tokens = 200;
        } else {
          completionParams.max_tokens = 200;
        }

        const completion = await this.openai.chat.completions.create(completionParams);
        content = completion.choices[0]?.message?.content;
      }

      if (!content) {
        throw new Error('Empty response from LLM');
      }

      logger.info(`Firm ${firmNumber} message: ${content.substring(0, 100)}...`);
      return content.trim();
    } catch (error) {
      logger.error(`Error getting communication from Firm ${firmNumber}:`, error);
      throw error;
    }
  }

  /**
   * Run communication phase between firms (supports N firms)
   */
  async runCommunicationPhase(
    config: CournotConfig,
    currentRound: number,
    history: RoundResult[]
  ): Promise<{ firm: number; message: string }[]> {
    const messagesPerRound = config.communication.messagesPerRound || 2;
    const numFirms = getNumFirms(config);
    const conversation: { firm: number; message: string }[] = [];

    // Rotate through firms
    for (let i = 0; i < messagesPerRound; i++) {
      // Cycle through firms: 1, 2, ..., n, 1, 2, ...
      const currentFirm = (i % numFirms) + 1;

      const message = await this.getCommunicationMessage(
        config,
        currentFirm,
        currentRound,
        history,
        conversation
      );

      conversation.push({ firm: currentFirm, message });
    }

    return conversation;
  }
}
