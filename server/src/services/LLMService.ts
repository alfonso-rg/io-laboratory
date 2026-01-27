import OpenAI from 'openai';
import { CournotConfig, RoundResult, LLMDecision } from '../types';
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
   */
  private generateSystemPrompt(config: CournotConfig, firmNumber: 1 | 2): string {
    const linearCost = firmNumber === 1 ? config.firm1LinearCost : config.firm2LinearCost;
    const quadraticCost = firmNumber === 1 ? config.firm1QuadraticCost : config.firm2QuadraticCost;

    let costDescription = `C(q) = ${linearCost} * q`;
    if (quadraticCost > 0) {
      costDescription += ` + ${quadraticCost} * q²`;
    }

    return `You are Firm ${firmNumber} in a Cournot quantity competition game.

GAME RULES:
- You compete with another firm in the same market
- Each round, both firms simultaneously choose a production quantity
- Market price is determined by total quantity: P = ${config.demandIntercept} - ${config.demandSlope} * (q1 + q2)
- Your cost function: ${costDescription}
- Your profit = (Market Price × Your Quantity) - Your Cost

YOUR OBJECTIVE:
Maximize your total profit over ${config.totalRounds} rounds.

STRATEGY CONSIDERATIONS:
- If you produce more, market price falls (hurting both firms)
- If you produce less, you earn less revenue but keep price higher
- The other firm is also an AI trying to maximize its profit
- Past behavior of the opponent may inform your expectations

RESPONSE FORMAT:
- First line: ONLY the quantity you want to produce (a non-negative number)
- Following lines (optional): Your reasoning

Example response:
25.5
I chose this quantity because...`;
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
