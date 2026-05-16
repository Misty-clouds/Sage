import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmployeesService } from '../employees/employees.service';
import { UserDocument } from '../users/schemas/user.schema';
import { UserRole } from '../common/enums';
import { SeedAdminDto } from './dto/seed-admin.dto';
import { InviteDto } from './dto/invite.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

const OTP_TTL_MINUTES = 10;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
    private employeesService: EmployeesService,
  ) {}

  async validateUser(email: string, password: string): Promise<UserDocument | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordHash) return null;
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return null;
    return user;
  }

  async login(user: UserDocument): Promise<{ access_token: string }> {
    // Admins seeded before orgId was set: fall back to their own _id as orgId
    const orgId = user.orgId?.toString() || String(user._id);
    const payload = {
      sub: String(user._id),
      email: user.email,
      role: user.role,
      orgId,
    };
    return { access_token: this.jwtService.sign(payload) };
  }

  async seedAdmin(dto: SeedAdminDto): Promise<{ message: string }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new UnauthorizedException('Email already registered.');
    await this.usersService.create(dto);
    return { message: 'Admin created.' };
  }

  // ─── Invite ────────────────────────────────────────────────────────────────

  async invite(dto: InviteDto, inviterUserId: string): Promise<{ message: string }> {
    const inviter = await this.usersService.findById(inviterUserId);
    if (!inviter) throw new NotFoundException('Inviting user not found.');

    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new BadRequestException('An account with this email already exists.');

    // Admins seeded before orgId was set fall back to their own _id as orgId
    const orgId = inviter.orgId?.toString() || String(inviter._id);

    const role = dto.role === 'auditor' ? UserRole.AUDITOR : UserRole.EMPLOYEE;
    await this.usersService.createInvited(dto.name, dto.email, role, inviter.orgName, orgId);

    // Create a payroll Employee record so the person appears in the employees list
    await this.employeesService.createFromInvite(orgId, dto.name, dto.email, dto.role, dto.accountNumber, dto.phone);

    // Send welcome email — fire and forget so the response is fast
    this.notificationsService.sendWelcomeEmail(dto.email, dto.name, dto.role).catch(() => null);

    return { message: `Invitation sent to ${dto.email}.` };
  }

  // ─── OTP ───────────────────────────────────────────────────────────────────

  async requestOtp(dto: RequestOtpDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      // Return same response to avoid email enumeration
      return { message: 'If that email is registered, a code has been sent.' };
    }

    // HR admins use password login — OTP is only for employees & auditors
    if (user.role === UserRole.HR_ADMIN) {
      throw new BadRequestException('HR admin accounts use password sign-in.');
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await this.usersService.setOtp(String(user._id), code, expiresAt);

    this.notificationsService.sendOtpEmail(user.email, user.name, code).catch(() => null);

    return { message: 'If that email is registered, a code has been sent.' };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ access_token: string }> {
    const user = await this.usersService.findByEmailWithOtp(dto.email);

    if (!user || !user.otpCode || !user.otpExpiresAt) {
      throw new UnauthorizedException('Invalid or expired code.');
    }

    if (new Date() > user.otpExpiresAt) {
      await this.usersService.clearOtp(String(user._id));
      throw new UnauthorizedException('Code has expired. Please request a new one.');
    }

    if (dto.code !== user.otpCode) {
      throw new UnauthorizedException('Invalid or expired code.');
    }

    await this.usersService.clearOtp(String(user._id));

    const payload = {
      sub: String(user._id),
      email: user.email,
      role: user.role,
      orgId: user.orgId?.toString() ?? '',
    };
    return { access_token: this.jwtService.sign(payload) };
  }
}
