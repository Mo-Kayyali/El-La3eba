import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllSuggestions(filters: { status?: 'PENDING' | 'APPROVED' | 'REJECTED'; page?: number; limit?: number } = {}) {
    const whereClause = filters.status ? { status: filters.status } : {};
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const total = await this.prisma.answerSuggestion.count({ where: whereClause });
    const data = await this.prisma.answerSuggestion.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: {
        question: true,
        player: true,
        suggester: {
          select: { id: true, username: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data,
      meta: {
        total,
        page,
        totalPages: Math.ceil(total / limit)
      }
    };
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
