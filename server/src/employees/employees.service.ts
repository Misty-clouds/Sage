import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { parse } from 'csv-parse/sync';
import { Employee, EmployeeDocument } from './schemas/employee.schema';
import { EmployeeStatus } from '../common/enums';

interface CsvRow {
  Name: string;
  Role: string;
  'Account Number': string;
  'Phone Number': string;
  Email?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  warnings: string[];
}

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(Employee.name) private employeeModel: Model<EmployeeDocument>,
  ) {}

  async createFromInvite(
    orgId: string,
    name: string,
    email: string,
    roleTitle: string,
    accountNumber?: string,
    phone?: string,
  ): Promise<EmployeeDocument> {
    return this.employeeModel.create({
      orgId: new Types.ObjectId(orgId),
      name,
      email,
      roleTitle,
      accountNumber: accountNumber ?? null,
      phone: phone ?? null,
      status: EmployeeStatus.PENDING,
    }) as Promise<EmployeeDocument>;
  }

  async findAll(
    orgId: string,
    status?: EmployeeStatus,
    search?: string,
    page = 1,
    limit = 20,
    allOrgs = false,
  ): Promise<{ data: EmployeeDocument[]; total: number }> {
    if (!allOrgs && (!orgId || !Types.ObjectId.isValid(orgId))) {
      return { data: [], total: 0 };
    }

    const filter: Record<string, unknown> = { deletedAt: false };
    if (!allOrgs) filter.orgId = new Types.ObjectId(orgId);
    if (status) filter.status = status;
    if (search) {
      filter['$or'] = [
        { name: { $regex: search, $options: 'i' } },
        { roleTitle: { $regex: search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.employeeModel
        .find(filter)
        .skip((page - 1) * Math.min(limit, 100))
        .limit(Math.min(limit, 100))
        .sort({ dnaScore: 1 })
        .lean()
        .exec(),
      this.employeeModel.countDocuments(filter).exec(),
    ]);

    const serialized = data.map(d => ({ ...d, _id: String(d._id) }));
    return { data: serialized as unknown as EmployeeDocument[], total };
  }

  async findById(id: string, orgId: string): Promise<EmployeeDocument> {
    const employee = await this.employeeModel
      .findOne({ _id: new Types.ObjectId(id), orgId: new Types.ObjectId(orgId) })
      .lean()
      .exec();
    if (!employee) throw new NotFoundException('Employee not found.');
    return { ...employee, _id: String(employee._id) } as unknown as EmployeeDocument;
  }

  async findByEmail(email: string): Promise<EmployeeDocument | null> {
    const employee = await this.employeeModel
      .findOne({ email: email.toLowerCase() })
      .lean()
      .exec();
    if (!employee) return null;
    return { ...employee, _id: String(employee._id) } as unknown as EmployeeDocument;
  }

  async updateStatus(
    id: string,
    orgId: string,
    status: EmployeeStatus,
  ): Promise<EmployeeDocument> {
    const employee = await this.employeeModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), orgId: new Types.ObjectId(orgId) },
        { status },
        { new: true },
      )
      .lean()
      .exec();
    if (!employee) throw new NotFoundException('Employee not found.');
    return { ...employee, _id: String(employee._id) } as unknown as EmployeeDocument;
  }

  async updateStatusById(
    id: string,
    status: EmployeeStatus,
  ): Promise<EmployeeDocument> {
    const employee = await this.employeeModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .lean()
      .exec();
    if (!employee) throw new NotFoundException('Employee not found.');
    return { ...employee, _id: String(employee._id) } as unknown as EmployeeDocument;
  }

  async importFromCsv(
    orgId: string,
    buffer: Buffer,
  ): Promise<ImportResult> {
    let rows: CsvRow[];
    try {
      rows = parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as CsvRow[];
    } catch {
      throw new BadRequestException('Invalid CSV format.');
    }

    const requiredColumns: (keyof CsvRow)[] = [
      'Name',
      'Role',
      'Account Number',
      'Phone Number',
    ];
    if (rows.length > 0) {
      const firstRow = rows[0];
      for (const col of requiredColumns) {
        if (!(col in firstRow)) {
          throw new BadRequestException(
            `Missing required column: "${col}". Required columns: ${requiredColumns.join(', ')}`,
          );
        }
      }
    }

    let imported = 0;
    let skipped = 0;
    const warnings: string[] = [];

    for (const row of rows) {
      const phone = row['Phone Number']?.trim();
      const accountNumber = row['Account Number']?.trim();
      const name = row['Name']?.trim();
      const roleTitle = row['Role']?.trim();
      const email = row['Email']?.trim() || null;

      if (!phone || !accountNumber) {
        skipped++;
        warnings.push(`Row skipped — missing data: ${JSON.stringify(row)}`);
        continue;
      }

      const exists = await this.employeeModel
        .findOne({ phone })
        .lean()
        .exec();
      if (exists) {
        skipped++;
        warnings.push(`Duplicate phone skipped: ${phone}`);
        continue;
      }

      await this.employeeModel.create({
        orgId: new Types.ObjectId(orgId),
        name,
        roleTitle,
        accountNumber,
        phone,
        email,
        status: EmployeeStatus.PENDING,
      });
      imported++;
    }

    return { imported, skipped, warnings };
  }

  async updateDnaScore(
    id: string,
    score: number,
  ): Promise<void> {
    const status =
      score >= 70
        ? EmployeeStatus.CLEAR
        : score >= 40
          ? EmployeeStatus.REVIEW
          : EmployeeStatus.FROZEN;

    await this.employeeModel
      .findByIdAndUpdate(id, {
        dnaScore: score,
        status,
        lastVerifiedAt: new Date(),
      })
      .exec();
  }

  maskAccountNumber(accountNumber: string | null): string {
    if (!accountNumber || accountNumber.length < 4) return '****';
    return `****${accountNumber.slice(-4)}`;
  }

  maskPhone(phone: string | null): string {
    if (!phone || phone.length < 7) return '***';
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  }
}
