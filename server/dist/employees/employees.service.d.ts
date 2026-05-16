import { Model } from 'mongoose';
import { EmployeeDocument } from './schemas/employee.schema';
import { EmployeeStatus } from '../common/enums';
export interface ImportResult {
    imported: number;
    skipped: number;
    warnings: string[];
}
export declare class EmployeesService {
    private employeeModel;
    constructor(employeeModel: Model<EmployeeDocument>);
    createFromInvite(orgId: string, name: string, email: string, roleTitle: string, accountNumber?: string, phone?: string): Promise<EmployeeDocument>;
    findAll(orgId: string, status?: EmployeeStatus, search?: string, page?: number, limit?: number, allOrgs?: boolean): Promise<{
        data: EmployeeDocument[];
        total: number;
    }>;
    findById(id: string, orgId: string): Promise<EmployeeDocument>;
    findByEmail(email: string): Promise<EmployeeDocument | null>;
    updateStatus(id: string, orgId: string, status: EmployeeStatus): Promise<EmployeeDocument>;
    updateStatusById(id: string, status: EmployeeStatus): Promise<EmployeeDocument>;
    importFromCsv(orgId: string, buffer: Buffer): Promise<ImportResult>;
    updateDnaScore(id: string, score: number): Promise<void>;
    maskAccountNumber(accountNumber: string | null): string;
    maskPhone(phone: string | null): string;
}
