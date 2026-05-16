import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmployeesService } from '../employees/employees.service';
import { UserDocument } from '../users/schemas/user.schema';
import { SeedAdminDto } from './dto/seed-admin.dto';
import { InviteDto } from './dto/invite.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
export declare class AuthService {
    private usersService;
    private jwtService;
    private notificationsService;
    private employeesService;
    private readonly logger;
    constructor(usersService: UsersService, jwtService: JwtService, notificationsService: NotificationsService, employeesService: EmployeesService);
    validateUser(email: string, password: string): Promise<UserDocument | null>;
    login(user: UserDocument): Promise<{
        access_token: string;
    }>;
    seedAdmin(dto: SeedAdminDto): Promise<{
        message: string;
    }>;
    invite(dto: InviteDto, inviterUserId: string): Promise<{
        message: string;
    }>;
    requestOtp(dto: RequestOtpDto): Promise<{
        message: string;
    }>;
    verifyOtp(dto: VerifyOtpDto): Promise<{
        access_token: string;
    }>;
}
