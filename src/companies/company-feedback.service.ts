import { Injectable, NotFoundException } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFeedbackDto,
  FeedbackPageQueryDto,
  UpdateFeedbackDto,
} from './dto/feedback.dto';

// Field lists are explicit so each audience receives only what it needs.
const sentFeedbackSelect = {
  id: true,
  message: true,
  createdAt: true,
  updatedAt: true,
  studentProfile: { select: { id: true, fullName: true } },
} as const;

const receivedFeedbackSelect = {
  id: true,
  message: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { name: true } },
} as const;

type SentFeedbackRow = {
  id: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
  studentProfile: { id: string; fullName: string };
};

function pageMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

@Injectable()
export class CompanyFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompanyForUser(userId: string) {
    const company = await this.prisma.companyProfile.findUnique({
      where: { userId },
      select: { id: true, name: true },
    });

    if (!company) {
      throw new NotFoundException('Company profile not found');
    }

    return company;
  }

  /**
   * Companies can write feedback only for published profiles (public with a
   * valid contact email), the same rule public discovery uses. Hidden or
   * unknown profiles return the same 404 so their existence is not revealed.
   */
  async create(userId: string, dto: CreateFeedbackDto) {
    const company = await this.getCompanyForUser(userId);
    const student = await this.prisma.studentProfile.findFirst({
      where: {
        id: dto.studentProfileId,
        isPublic: true,
        contactEmail: { not: null },
      },
      select: { id: true, contactEmail: true },
    });

    if (!student || !student.contactEmail || !isEmail(student.contactEmail)) {
      throw new NotFoundException('Student profile not found');
    }

    const created = await this.prisma.companyFeedback.create({
      data: {
        companyProfileId: company.id,
        studentProfileId: student.id,
        message: dto.message,
      },
      select: sentFeedbackSelect,
    });

    return this.toSent(created);
  }

  async listSent(userId: string, query: FeedbackPageQueryDto) {
    const company = await this.getCompanyForUser(userId);
    const where = { companyProfileId: company.id };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.companyFeedback.count({ where }),
      this.prisma.companyFeedback.findMany({
        where,
        select: sentFeedbackSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      data: rows.map((row) => this.toSent(row)),
      meta: pageMeta(query.page, query.limit, total),
    };
  }

  /** Only the authoring company can edit; anything else is a 404. */
  async update(userId: string, feedbackId: string, dto: UpdateFeedbackDto) {
    const company = await this.getCompanyForUser(userId);
    const result = await this.prisma.companyFeedback.updateMany({
      where: { id: feedbackId, companyProfileId: company.id },
      data: { message: dto.message },
    });

    if (result.count === 0) {
      throw new NotFoundException('Feedback not found');
    }

    const updated = await this.prisma.companyFeedback.findFirst({
      where: { id: feedbackId, companyProfileId: company.id },
      select: sentFeedbackSelect,
    });

    if (!updated) {
      throw new NotFoundException('Feedback not found');
    }

    return this.toSent(updated);
  }

  /** Only the authoring company can delete; anything else is a 404. */
  async remove(userId: string, feedbackId: string): Promise<void> {
    const company = await this.getCompanyForUser(userId);
    const result = await this.prisma.companyFeedback.deleteMany({
      where: { id: feedbackId, companyProfileId: company.id },
    });

    if (result.count === 0) {
      throw new NotFoundException('Feedback not found');
    }
  }

  /** Feedback addressed to the authenticated student, newest first. */
  async listReceived(userId: string, query: FeedbackPageQueryDto) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Student profile not found');
    }

    const where = { studentProfileId: profile.id };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.companyFeedback.count({ where }),
      this.prisma.companyFeedback.findMany({
        where,
        select: receivedFeedbackSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      data: rows,
      meta: pageMeta(query.page, query.limit, total),
    };
  }

  private toSent(row: SentFeedbackRow) {
    return {
      id: row.id,
      message: row.message,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      student: row.studentProfile,
    };
  }
}
