export declare enum InviteRole {
    EMPLOYEE = "employee",
    AUDITOR = "auditor"
}
export declare class InviteDto {
    name: string;
    email: string;
    role: InviteRole;
    accountNumber?: string;
    phone?: string;
    salary?: string;
}
