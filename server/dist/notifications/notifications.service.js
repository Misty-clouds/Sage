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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const expo_server_sdk_1 = __importDefault(require("expo-server-sdk"));
const resend_1 = require("resend");
const axios_1 = __importDefault(require("axios"));
const FROM_ADDRESS = 'Sage AI <noreply@cloudstech.org>';
let NotificationsService = NotificationsService_1 = class NotificationsService {
    configService;
    logger = new common_1.Logger(NotificationsService_1.name);
    expo = new expo_server_sdk_1.default();
    resend = null;
    constructor(configService) {
        this.configService = configService;
        const resendApiKey = this.configService.get('email.resendApiKey');
        if (resendApiKey) {
            this.resend = new resend_1.Resend(resendApiKey);
            this.logger.log(`Resend initialised — from: ${FROM_ADDRESS}`);
        }
        else {
            this.logger.warn('RESEND_API_KEY not set — emails will not be sent');
        }
    }
    async sendEmail(opts) {
        if (!this.resend) {
            this.logger.error(`[${opts.label}] Cannot send — RESEND_API_KEY not configured (to: ${opts.to})`);
            throw new Error('Email service not configured. Set RESEND_API_KEY.');
        }
        const { data, error } = await this.resend.emails.send({
            from: FROM_ADDRESS,
            to: opts.to,
            subject: opts.subject,
            html: opts.html,
        });
        if (error) {
            this.logger.error(`[${opts.label}] Failed to deliver to ${opts.to} — ${error.name}: ${error.message}`);
            throw new Error(`${error.name}: ${error.message}`);
        }
        this.logger.log(`[${opts.label}] Delivered to ${opts.to} — id: ${data?.id}`);
    }
    async sendWelcomeEmail(to, name, role) {
        const roleLabel = role === 'auditor' ? 'an Auditor' : 'an Employee';
        const appUrl = this.configService.get('app.deepLinkBaseUrl') ?? 'http://localhost:3000';
        const loginUrl = `${appUrl}/login`;
        await this.sendEmail({
            to,
            label: 'WelcomeEmail',
            subject: `You've been added to Sage AI as ${roleLabel}`,
            html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1e1e1e;">
          <div style="margin-bottom:24px;">
            <span style="font-size:20px;font-weight:700;color:#3a6e57;">Sage AI</span>
          </div>
          <h2 style="font-size:22px;font-weight:700;margin:0 0 8px;">Welcome, ${name} 👋</h2>
          <p style="color:#4e4e4e;margin:0 0 16px;">
            Your account has been created on <strong>Sage AI</strong> — the payroll integrity system.
            You have been added as <strong>${roleLabel}</strong>.
          </p>
          <p style="color:#4e4e4e;margin:0 0 24px;">
            To sign in, click the button below and enter your email address.
            A 6-digit confirmation code will be sent to you — no password needed.
          </p>
          <a href="${loginUrl}" style="
            display:inline-block;
            padding:13px 28px;
            background:#3a6e57;
            color:#ffffff;
            text-decoration:none;
            border-radius:8px;
            font-weight:600;
            font-size:15px;
          ">Sign in to Sage AI</a>
          <hr style="border:none;border-top:1px solid #e0e3dc;margin:32px 0;" />
          <p style="color:#828282;font-size:12px;margin:0;">
            If you were not expecting this email, you can safely ignore it.
          </p>
        </div>
      `,
        });
    }
    async sendOtpEmail(to, name, code) {
        await this.sendEmail({
            to,
            label: 'OtpEmail',
            subject: 'Your Sage AI sign-in code',
            html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1e1e1e;">
          <div style="margin-bottom:24px;">
            <span style="font-size:20px;font-weight:700;color:#3a6e57;">Sage AI</span>
          </div>
          <h2 style="font-size:22px;font-weight:700;margin:0 0 8px;">Your sign-in code</h2>
          <p style="color:#4e4e4e;margin:0 0 24px;">Hi ${name}, use the code below to sign in. It expires in <strong>10 minutes</strong>.</p>
          <div style="
            display:inline-block;
            padding:16px 32px;
            background:#f0faf5;
            border:2px solid #3a6e57;
            border-radius:12px;
            font-size:36px;
            font-weight:700;
            letter-spacing:0.35em;
            color:#3a6e57;
          ">${code}</div>
          <hr style="border:none;border-top:1px solid #e0e3dc;margin:32px 0;" />
          <p style="color:#828282;font-size:12px;margin:0;">
            If you did not request this code, please ignore this email. Do not share it with anyone.
          </p>
        </div>
      `,
        });
    }
    async sendVerificationEmail(to, employeeName, deepLink, deadline, deadlineStr) {
        const formatted = deadlineStr ?? deadline.toLocaleDateString('en-NG', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        });
        await this.sendEmail({
            to,
            label: 'VerificationEmail',
            subject: 'Action Required: Complete Your Salary Verification',
            html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1e1e1e;">
          <div style="margin-bottom:24px;">
            <span style="font-size:20px;font-weight:700;color:#3a6e57;">Sage AI</span>
          </div>
          <h2 style="font-size:22px;font-weight:700;margin:0 0 8px;">Salary Verification Required</h2>
          <p style="color:#4e4e4e;margin:0 0 16px;">
            Hi ${employeeName}, your salary verification is now open.
            Please complete it before <strong>${formatted}</strong>.
          </p>
          <a href="${deepLink}" style="
            display:inline-block;
            padding:13px 28px;
            background:#3a6e57;
            color:#ffffff;
            text-decoration:none;
            border-radius:8px;
            font-weight:600;
            font-size:15px;
          ">Verify Now</a>
          <p style="color:#4e4e4e;font-size:13px;margin:20px 0 0;">
            If the button doesn't work, copy this link into your browser:<br/>
            <a href="${deepLink}" style="color:#3a6e57;">${deepLink}</a>
          </p>
          <hr style="border:none;border-top:1px solid #e0e3dc;margin:32px 0;" />
          <p style="color:#828282;font-size:12px;margin:0;">
            This link expires on ${formatted}. Do not share it with anyone.
          </p>
        </div>
      `,
        });
    }
    async sendVerificationSms(phone, employeeName, deepLink, deadline, email) {
        const deadlineStr = deadline.toLocaleDateString('en-NG', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        });
        const apiKey = this.configService.get('sms.termiiApiKey');
        if (apiKey) {
            const message = `Hi ${employeeName}, your salary verification is now open. ` +
                `Tap to verify before ${deadlineStr}: ${deepLink}`;
            await this.sendSms(phone, message);
        }
        else if (email) {
            this.logger.warn(`Termii not configured — falling back to email for ${employeeName}`);
            await this.sendVerificationEmail(email, employeeName, deepLink, deadline, deadlineStr);
        }
        else {
            this.logger.warn(`Cannot deliver verification to ${employeeName}: Termii unconfigured and no email on record`);
        }
    }
    async sendSms(phone, message) {
        const apiKey = this.configService.get('sms.termiiApiKey');
        const baseUrl = this.configService.get('sms.termiiBaseUrl');
        const senderId = this.configService.get('sms.senderId');
        if (!apiKey) {
            this.logger.warn(`SMS not sent (no API key) to: ${phone}`);
            return;
        }
        try {
            await axios_1.default.post(`${baseUrl}/api/sms/send`, {
                to: phone, from: senderId, sms: message,
                type: 'plain', channel: 'generic', api_key: apiKey,
            });
            this.logger.log(`SMS sent to ${phone}`);
        }
        catch (error) {
            this.logger.error(`SMS failed to ${phone}`, error.message);
        }
    }
    async sendFreezeEmail(to, name) {
        await this.sendEmail({
            to,
            label: 'FreezeEmail',
            subject: '⚠️ Your Sage AI account has been frozen',
            html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1e1e1e;">
          <div style="margin-bottom:24px;">
            <span style="font-size:20px;font-weight:700;color:#3a6e57;">Sage AI</span>
          </div>
          <div style="background:#fff1f2;border:1.5px solid #fecaca;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
            <h2 style="font-size:20px;font-weight:700;margin:0 0 8px;color:#b91c1c;">❄️ Account Frozen</h2>
            <p style="color:#7f1d1d;margin:0;font-size:14px;line-height:1.6;">
              Hi <strong>${name}</strong>, your payroll account on <strong>Sage AI</strong> has been
              <strong>frozen</strong> by a compliance auditor following a risk review.
            </p>
          </div>
          <p style="color:#4e4e4e;font-size:14px;line-height:1.7;margin:0 0 16px;">
            This means your salary disbursement has been <strong>temporarily blocked</strong>
            pending verification. You will need to complete a fresh liveness check to restore access.
          </p>
          <p style="color:#4e4e4e;font-size:14px;line-height:1.7;margin:0 0 24px;">
            Please contact your <strong>HR administrator</strong> immediately or open the Sage AI
            mobile app to begin the verification process.
          </p>
          <hr style="border:none;border-top:1px solid #e0e3dc;margin:24px 0;" />
          <p style="color:#828282;font-size:12px;margin:0;">
            If you believe this was an error, contact your HR admin. Do not reply to this email.
          </p>
        </div>
      `,
        });
    }
    async sendPushNotification(expoPushTokens, title, body, data) {
        const validTokens = expoPushTokens.filter(expo_server_sdk_1.default.isExpoPushToken);
        if (validTokens.length === 0) {
            this.logger.warn('No valid Expo push tokens provided');
            return;
        }
        const messages = validTokens.map(to => ({
            to, title, body, data, sound: 'default',
        }));
        for (const chunk of this.expo.chunkPushNotifications(messages)) {
            try {
                const tickets = await this.expo.sendPushNotificationsAsync(chunk);
                tickets.forEach((ticket, i) => {
                    if (ticket.status === 'error') {
                        this.logger.error(`Push failed for ${validTokens[i]}: ${ticket.message}`);
                    }
                });
                this.logger.log(`Push sent to ${chunk.length} device(s): ${title}`);
            }
            catch (error) {
                this.logger.error('Push chunk failed', error.message);
            }
        }
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map