import sgMail from '@sendgrid/mail';
import { env } from '$env/dynamic/private';

const apiKey = env.SENDGRID_API_KEY;
const fromEmail = env.FROM_EMAIL ?? 'noreply@3alarmlabs.com';

if (apiKey) {
	sgMail.setApiKey(apiKey);
}

export interface SendEmailOptions {
	to: string;
	subject: string;
	text: string;
	html?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
	if (!apiKey) {
		console.warn('[email] SENDGRID_API_KEY not set, skipping email send');
		return;
	}
	try {
		await sgMail.send({ to: opts.to, from: fromEmail, subject: opts.subject, text: opts.text, html: opts.html });
	} catch (err) {
		console.error('[email] SendGrid error:', err);
		throw err;
	}
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
	const subject = 'Reset your password — 3 Alarm Labs';
	const text = `Click the link below to reset your password:\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`;
	const html = `
		<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
			<p style="font-size: 16px; color: #374151;">Click the button below to reset your password.</p>
			<p style="margin: 24px 0;">
				<a href="${resetUrl}" style="display: inline-block; background-color: #E85D20; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset password</a>
			</p>
			<p style="font-size: 12px; color: #9ca3af;">If you didn't request this, you can safely ignore this email.</p>
		</div>
	`.trim();
	await sendEmail({ to, subject, text, html });
}

export async function sendInviteEmail(to: string, inviteUrl: string, organizationName: string): Promise<void> {
	const subject = `You're invited to join ${organizationName} on 3 Alarm Labs`;
	const text = `You've been invited to join ${organizationName} on 3 Alarm Labs.\n\nAccept the invite:\n${inviteUrl}`;
	const html = `
		<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
			<p style="font-size: 16px; color: #374151;">You've been invited to join <strong>${organizationName}</strong> on 3 Alarm Labs.</p>
			<p style="margin: 24px 0;">
				<a href="${inviteUrl}" style="display: inline-block; background-color: #E85D20; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Accept invite</a>
			</p>
		</div>
	`.trim();
	await sendEmail({ to, subject, text, html });
}
