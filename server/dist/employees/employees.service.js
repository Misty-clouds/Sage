"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const sync_1 = require("csv-parse/sync");
const employee_schema_1 = require("./schemas/employee.schema");
const enums_1 = require("../common/enums");
let EmployeesService = class EmployeesService {
    employeeModel;
    constructor(employeeModel) {
        this.employeeModel = employeeModel;
    }
    async createFromInvite(orgId, name, email, roleTitle, accountNumber, phone) {
        return this.employeeModel.create({
            orgId: new mongoose_2.Types.ObjectId(orgId),
            name,
            email,
            roleTitle,
            accountNumber: accountNumber ?? null,
            phone: phone ?? null,
            status: enums_1.EmployeeStatus.PENDING,
        });
    }
    async findAll(orgId, status, search, page = 1, limit = 20, allOrgs = false) {
        if (!allOrgs && (!orgId || !mongoose_2.Types.ObjectId.isValid(orgId))) {
            return { data: [], total: 0 };
        }
        const filter = { deletedAt: false };
        if (!allOrgs)
            filter.orgId = new mongoose_2.Types.ObjectId(orgId);
        if (status)
            filter.status = status;
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
        return { data: serialized, total };
    }
    async findById(id, orgId) {
        const employee = await this.employeeModel
            .findOne({ _id: new mongoose_2.Types.ObjectId(id), orgId: new mongoose_2.Types.ObjectId(orgId) })
            .lean()
            .exec();
        if (!employee)
            throw new common_1.NotFoundException('Employee not found.');
        return { ...employee, _id: String(employee._id) };
    }
    async findByEmail(email) {
        const employee = await this.employeeModel
            .findOne({ email: email.toLowerCase() })
            .lean()
            .exec();
        if (!employee)
            return null;
        return { ...employee, _id: String(employee._id) };
    }
    async updateStatus(id, orgId, status) {
        const employee = await this.employeeModel
            .findOneAndUpdate({ _id: new mongoose_2.Types.ObjectId(id), orgId: new mongoose_2.Types.ObjectId(orgId) }, { status }, { new: true })
            .lean()
            .exec();
        if (!employee)
            throw new common_1.NotFoundException('Employee not found.');
        return { ...employee, _id: String(employee._id) };
    }
    async updateStatusById(id, status) {
        const employee = await this.employeeModel
            .findByIdAndUpdate(id, { status }, { new: true })
            .lean()
            .exec();
        if (!employee)
            throw new common_1.NotFoundException('Employee not found.');
        return { ...employee, _id: String(employee._id) };
    }
    async importFromCsv(orgId, buffer) {
        let rows;
        try {
            rows = (0, sync_1.parse)(buffer, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            });
        }
        catch {
            throw new common_1.BadRequestException('Invalid CSV format.');
        }
        const requiredColumns = [
            'Name',
            'Role',
            'Account Number',
            'Phone Number',
        ];
        if (rows.length > 0) {
            const firstRow = rows[0];
            for (const col of requiredColumns) {
                if (!(col in firstRow)) {
                    throw new common_1.BadRequestException(`Missing required column: "${col}". Required columns: ${requiredColumns.join(', ')}`);
                }
            }
        }
        let imported = 0;
        let skipped = 0;
        const warnings = [];
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
                orgId: new mongoose_2.Types.ObjectId(orgId),
                name,
                roleTitle,
                accountNumber,
                phone,
                email,
                status: enums_1.EmployeeStatus.PENDING,
            });
            imported++;
        }
        return { imported, skipped, warnings };
    }
    async updateDnaScore(id, score) {
        const status = score >= 70
            ? enums_1.EmployeeStatus.CLEAR
            : score >= 40
                ? enums_1.EmployeeStatus.REVIEW
                : enums_1.EmployeeStatus.FROZEN;
        await this.employeeModel
            .findByIdAndUpdate(id, {
            dnaScore: score,
            status,
            lastVerifiedAt: new Date(),
        })
            .exec();
    }
    maskAccountNumber(accountNumber) {
        if (!accountNumber || accountNumber.length < 4)
            return '****';
        return `****${accountNumber.slice(-4)}`;
    }
    maskPhone(phone) {
        if (!phone || phone.length < 7)
            return '***';
        return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
    }
};
exports.EmployeesService = EmployeesService;
exports.EmployeesService = EmployeesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(employee_schema_1.Employee.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], EmployeesService);
//# sourceMappingURL=employees.service.js.map