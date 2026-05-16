"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcryptjs"));
const users_service_1 = require("../users/users.service");
const notifications_service_1 = require("../notifications/notifications.service");
const employees_service_1 = require("../employees/employees.service");
const enums_1 = require("../common/enums");
const OTP_TTL_MINUTES = 10;
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
let AuthService = class AuthService {
    usersService;
    jwtService;
    notificationsService;
    employeesService;
    constructor(usersService, jwtService, notificationsService, employeesService) {
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.notificationsService = notificationsService;
        this.employeesService = employeesService;
    }
    async validateUser(email, password) {
        const user = await this.usersService.findByEmail(email);
        if (!user || !user.passwordHash)
            return null;
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch)
            return null;
        return user;
    }
    async login(user) {
        const orgId = user.orgId?.toString() || String(user._id);
        const payload = {
            sub: String(user._id),
            email: user.email,
            role: user.role,
            orgId,
        };
        return { access_token: this.jwtService.sign(payload) };
    }
    async seedAdmin(dto) {
        const existing = await this.usersService.findByEmail(dto.email);
        if (existing)
            throw new common_1.UnauthorizedException('Email already registered.');
        await this.usersService.create(dto);
        return { message: 'Admin created.' };
    }
    async invite(dto, inviterUserId) {
        const inviter = await this.usersService.findById(inviterUserId);
        if (!inviter)
            throw new common_1.NotFoundException('Inviting user not found.');
        const existing = await this.usersService.findByEmail(dto.email);
        if (existing)
            throw new common_1.BadRequestException('An account with this email already exists.');
        const orgId = inviter.orgId?.toString() || String(inviter._id);
        const role = dto.role === 'auditor' ? enums_1.UserRole.AUDITOR : enums_1.UserRole.EMPLOYEE;
        await this.usersService.createInvited(dto.name, dto.email, role, inviter.orgName, orgId);
        await this.employeesService.createFromInvite(orgId, dto.name, dto.email, dto.role, dto.accountNumber, dto.phone);
        this.notificationsService.sendWelcomeEmail(dto.email, dto.name, dto.role).catch(() => null);
        return { message: `Invitation sent to ${dto.email}.` };
    }
    async requestOtp(dto) {
        const user = await this.usersService.findByEmail(dto.email);
        if (!user) {
            return { message: 'If that email is registered, a code has been sent.' };
        }
        if (user.role === enums_1.UserRole.HR_ADMIN) {
            throw new common_1.BadRequestException('HR admin accounts use password sign-in.');
        }
        const code = generateOtp();
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
        await this.usersService.setOtp(String(user._id), code, expiresAt);
        this.notificationsService.sendOtpEmail(user.email, user.name, code).catch(() => null);
        return { message: 'If that email is registered, a code has been sent.' };
    }
    async verifyOtp(dto) {
        const user = await this.usersService.findByEmailWithOtp(dto.email);
        if (!user || !user.otpCode || !user.otpExpiresAt) {
            throw new common_1.UnauthorizedException('Invalid or expired code.');
        }
        if (new Date() > user.otpExpiresAt) {
            await this.usersService.clearOtp(String(user._id));
            throw new common_1.UnauthorizedException('Code has expired. Please request a new one.');
        }
        if (dto.code !== user.otpCode) {
            throw new common_1.UnauthorizedException('Invalid or expired code.');
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
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService,
        notifications_service_1.NotificationsService,
        employees_service_1.EmployeesService])
], AuthService);
//# sourceMappingURL=auth.service.js.map