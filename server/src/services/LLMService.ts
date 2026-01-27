import OpenAI from 'openai';
import { CournotConfig, RoundResult, LLMDecision, InformationDisclosure } from '../types';
import { logger } from '../config/logger';

export class LLMService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate the system prompt explaining the Cournot game
   * Respects information disclosure settings
   */
  private generateSystemPrompt(config: CournotConfig, firmNumber: 1 | 2): string {
    const info = firmNumber === 1 ? config.firm1Info : config.firm2Info;
    const ownLinearCost = firmNumber === 1 ? config.firm1LinearCost : config.firm2LinearCost;
    const ownQuadraticCost = firmNumber === 1 ? config.firm1QuadraticCost : config.firm2QuadraticCost;
    const rivalLinearCost = firmNumber === 1 ? config.firm2LinearCost : config.firm1LinearCost;
    const rivalQuadraticCost = firmNumber === 1 ? config.firm2QuadraticCost : config.firm1QuadraticCost;

    // Use custom prompt if provided
    if (config.customSystemPrompt) {
      return config.customSystemPrompt
        .replace(/{firmNumber}/g, String(firmNumber))
        .replace(/{totalRounds}/g, String(config.totalRounds))
        .replace(/{demandIntercept}/g, String(config.demandIntercept))
        .replace(/{demandSlope}/g, String(config.demandSlope))
        .replace(/{ownLinearCost}/g, String(ownLinearCost))
        .replace(/{ownQuadraticCost}/g, String(ownQuadraticCost))
        .replace(/{rivalLinearCost}/g, String(rivalLinearCost))
        .replace(/{rivalQuadraticCost}/g, String(rivalQuadraticCost));
    }

    let prompt = `You are Firm ${firmNumber} in a quantity competition game.\n\n`;
    prompt += 'GAME RULES:\n';
    prompt += '- You compete with another firm in the same market\n';
    prompt += '- Each round, both firms simultaneously choose a production quantity\n';

    // Demand function (if revealed)
    if (info.revealDemandFunction) {
      prompt += `- Market price is determined by total quantity: P = ${config.demandIntercept} - ${config.demandSlope} * (q1 + q2)\n`;
    } else {
      prompt += '- Market price decreases as total quantity increases\n';
    }

    // Own costs (if revealed)
    if (info.revealOwnCosts) {
      let costDescription = `C(q) = ${ownLinearCost} * q`;
      if (ownQuadraticCost > 0) {
        costDescription += ` + ${ownQuadraticCost} * q²`;
      }
      prompt += `- Your cost function: ${costDescription}\n`;
    } else {
      prompt += '- You have production costs that increase with quantity\n';
    }

    // Rival costs (if revealed)
    if (info.revealRivalCosts) {
      let rivalCostDescription = `C(q) = ${rivalLinearCost} * q`;
      if (rivalQuadraticCost > 0) {
        rivalCostDescription += ` + ${rivalQuadraticCost} * q²`;
      }
      prompt += `- Your rival's cost function: ${rivalCostDescription}\n`;
    }

    prompt += '- Your profit = (Market Price × Your Quantity) - Your Cost\n\n';

    prompt += 'YOUR OBJECTIVE:\n';
    prompt += `Maximize your total profit over ${config.totalRounds} rounds.\n\n`;

    prompt += 'STRATEGY CONSIDERATIONS:\n';
    prompt += '- If you produce more, market price falls (hurting both firms)\n';
    prompt += '- If you produce less, you earn less revenue but keep price higher\n';

    // Rival description
    if (info.describeRivalAsHuman) {
      prompt += '- The other firm is controlled by a human participant in an experiment\n';
    } else if (info.revealRivalIsLLM) {
      prompt += '- The other firm is also an AI trying to maximize its profit\n';
    } else {
      prompt += '- The other firm is also trying to maximize its profit\n';
    }

    prompt += '- Past behavior of the opponent may inform your expectations\n\n';

    prompt += 'RESPONSE FORMAT:\n';
    prompt += '- First line: ONLY the quantity you want to produce (a non-negative number)\n';
    prompt += '- Following lines (optional): Your reasoning\n\n';

    prompt += 'Example response:\n';
    prompt += '25.5\n';
    prompt += 'I chose this quantity because...';

    return prompt;
  }

  /**
   * Get the current system prompt for a firm (for display/editing)
   */
  getSystemPrompt(config: CournotConfig, firmNumber: 1 | 2): string {
    return this.generateSystemPrompt(config, firmNumber);
  }

  /**
   * Generate the round prompt with game history
   */
  private generateRoundPrompt(
    config: CournotConfig,
    firmNumber: 1 | 2,
    currentRound: number,
    history: RoundResult[]
  ): string {
    let prompt = `ROUND ${currentRound} of ${config.totalRounds}\n\n`;

    if (history.length > 0) {
      prompt += 'PREVIOUS ROUNDS:\n';
      prompt += '─'.repeat(60) + '\n';
      prompt += 'Round | Your Q | Their Q | Price  | Your Profit | Their Profit\n';
      prompt += '─'.repeat(60) + '\n';

      for (const round of history) {
        const yourQ = firmNumber === 1 ? round.firm1Quantity : round.firm2Quantity;
        const theirQ = firmNumber === 1 ? round.firm2Quantity : round.firm1Quantity;
        const yourProfit = firmNumber === 1 ? round.firm1Profit : round.firm2Profit;
        const theirProfit = firmNumber === 1 ? round.firm2Profit : round.firm1Profit;

        prompt += `  ${round.roundNumber.toString().padStart(2)}  |`;
        prompt += ` ${yourQ.toFixed(1).padStart(6)} |`;
        prompt += ` ${theirQ.toFixed(1).padStart(7)} |`;
        prompt += ` ${round.marketPrice.toFixed(1).padStart(6)} |`;
        prompt += ` ${yourProfit.toFixed(1).padStart(11)} |`;
        prompt += ` ${theirProfit.toFixed(1).padStart(12)}\n`;
      }
      prompt += '─'.repeat(60) + '\n\n';

      // Summary statistics
      const yourTotalProfit = history.reduce((sum, r) =>
        sum + (firmNumber === 1 ? r.firm1Profit : r.firm2Profit), 0);
      const theirTotalProfit = history.reduce((sum, r) =>
        sum + (firmNumber === 1 ? r.firm2Profit : r.firm1Profit), 0);

      prompt += `Your cumulative profit: ${yourTotalProfit.toFixed(1)}\n`;
      prompt += `Their cumulative profit: ${theirTotalProfit.toFixed(1)}\n\n`;
    } else {
      prompt += 'This is the first round. No history available.\n\n';
    }

    prompt += 'What quantity will you produce this round?\n';
    prompt += 'Remember: First line must be ONLY the quantity (a number).';

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
   */
  async getDecision(
    config: CournotConfig,
    firmNumber: 1 | 2,
    currentRound: number,
    history: RoundResult[]
  ): Promise<LLMDecision> {
    const model = firmNumber === 1 ? config.firm1Model : config.firm2Model;
    const systemPrompt = this.generateSystemPrompt(config, firmNumber);
    const userPrompt = this.generateRoundPrompt(config, firmNumber, currentRound, history);

    logger.info(`Requesting decision from Firm ${firmNumber} (${model}) for round ${currentRound}`);

    try {
      const completion = await this.openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from LLM');
      }

      const decision = this.parseResponse(content);

      // Validate quantity
      if (isNaN(decision.quantity) || decision.quantity < 0) {
        throw new Error(`Invalid quantity: ${decision.quantity}`);
      }

      logger.info(`Firm ${firmNumber} decided quantity: ${decision.quantity}`);
      return decision;
    } catch (error) {
      logger.error(`Error getting decision from Firm ${firmNumber}:`, error);
      throw error;
    }
  }

  /**
   * Get decisions from both firms concurrently
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
}
