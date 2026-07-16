import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPendingSuggestions() {
    return this.prisma.answerSuggestion.findMany({
      where: { status: 'PENDING' },
      include: {
        question: true,
        player: true,
        suggester: {
          select: { id: true, username: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveSuggestion(id: string, reviewNote?: string) {
    const suggestion = await this.prisma.answerSuggestion.findUnique({
      where: { id },
      include: { question: true },
    });

    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }

    let message = 'Suggestion approved.';
    let createdAnswer = false;

    if (suggestion.question.answerType === 'LIST') {
      const existing = await this.prisma.questionAnswer.findUnique({
        where: {
          questionId_playerId: {
            questionId: suggestion.questionId,
            playerId: suggestion.playerId,
          },
        },
      });

      if (!existing) {
        await this.prisma.questionAnswer.create({
          data: {
            questionId: suggestion.questionId,
            playerId: suggestion.playerId,
          },
        });
        createdAnswer = true;
        message = 'Suggestion approved and new QuestionAnswer created for LIST question.';
      } else {
        message = 'Suggestion approved, but QuestionAnswer already existed.';
      }
    } else {
      message = 'Suggestion approved for FILTER question. Admin recorded judgment signal.';
    }

    const updated = await this.prisma.answerSuggestion.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewNote,
        reviewedAt: new Date(),
      },
    });

    return { status: 'ok', message, createdAnswer, suggestion: updated };
  }

  async rejectSuggestion(id: string, reviewNote?: string) {
    const suggestion = await this.prisma.answerSuggestion.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewNote,
        reviewedAt: new Date(),
      },
    });

    return { status: 'ok', message: 'Suggestion rejected.', suggestion };
  }
}
