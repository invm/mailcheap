import "server-only";
import type { GetEmailIdentityCommandOutput } from "@aws-sdk/client-sesv2";
import {
	GetAccountCommand,
	GetEmailIdentityCommand,
	ListEmailIdentitiesCommand,
	SESv2Client,
	SendEmailCommand,
} from "@aws-sdk/client-sesv2";
import { isSendingEnabled } from "@/lib/config";

const REGION = process.env.SES_REGION || process.env.AWS_REGION || "us-east-1";
// The overview and the editor read the account and domains from here; the domains page asks fresh.
const CACHE_TTL_MS = 5 * 60_000;
// Reads only: a send that timed out could still have gone out, and the SDK would retry it.
const READ_TIMEOUT_MS = 5000;
const cache = new Map<string, { promise: Promise<unknown>; expiresAt: number }>();
let client: SESv2Client | undefined;

// Vercel reserves the AWS_* credential names; locally the default chain (~/.aws) is used.
function getCredentials(): { accessKeyId: string; secretAccessKey: string } | undefined {
	const { SES_ACCESS_KEY_ID: accessKeyId, SES_SECRET_ACCESS_KEY: secretAccessKey } = process.env;
	return accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;
}

function getClient() {
	client ??= new SESv2Client({ region: REGION, credentials: getCredentials() });
	return client;
}

function read(command: any): Promise<any> {
	return getClient().send(command, { abortSignal: AbortSignal.timeout(READ_TIMEOUT_MS) });
}

// Callers that arrive while a load is running share it. Errors aren't kept.
async function cached<T>(key: string, { fresh }: { fresh: boolean }, load: () => Promise<T>): Promise<T> {
	const hit = cache.get(key);
	if (!fresh && hit && hit.expiresAt > Date.now()) return hit.promise as Promise<T>;
	const entry = { promise: load(), expiresAt: Date.now() + CACHE_TTL_MS };
	cache.set(key, entry);
	const value = await entry.promise;
	if ((value as { error?: unknown })?.error && cache.get(key) === entry) cache.delete(key);
	return value;
}

export type SesAccount = { productionAccess: boolean; reviewStatus: string | null; sendingEnabled: boolean; enforcementStatus: string | undefined; max24HourSend: number; maxSendRate: number; sentLast24Hours: number } | { error: string };
export type SesDomain = { domain: string; verified: boolean; dkimStatus: string; mailFromDomain: string | null; mailFromStatus: string | null; records: Array<{ type: string; name: string; value: string }> };
export type SesDomainsResult = SesDomain[] | { error: string };

export function getSesAccount({ fresh = false } = {}): Promise<SesAccount> {
	return cached("account", { fresh }, loadSesAccount);
}

export function listSesDomains({ fresh = false } = {}): Promise<SesDomainsResult> {
	return cached("domains", { fresh }, loadSesDomains);
}

async function loadSesAccount(): Promise<SesAccount> {
	try {
		const account = await read(new GetAccountCommand({}));
		return {
			productionAccess: Boolean(account.ProductionAccessEnabled),
			reviewStatus: account.Details?.ReviewDetails?.Status || null,
			sendingEnabled: Boolean(account.SendingEnabled),
			enforcementStatus: account.EnforcementStatus,
			max24HourSend: account.SendQuota?.Max24HourSend ?? 0,
			maxSendRate: account.SendQuota?.MaxSendRate ?? 0,
			sentLast24Hours: account.SendQuota?.SentLast24Hours ?? 0,
		};
	} catch (error) {
		return { error: (error as Error).message };
	}
}

function dnsRecords(domain: string | undefined, identity: GetEmailIdentityCommandOutput): Array<{ type: string; name: string; value: string }> {
	const dkim = (identity.DkimAttributes?.Tokens || []).map((token) => ({
		type: "CNAME",
		name: `${token}._domainkey.${domain}`,
		value: `${token}.dkim.amazonses.com`,
	}));
	const mailFrom = identity.MailFromAttributes?.MailFromDomain;
	const bounce = mailFrom
		? [
				{ type: "MX", name: mailFrom, value: `10 feedback-smtp.${REGION}.amazonses.com` },
				{ type: "TXT", name: mailFrom, value: "v=spf1 include:amazonses.com ~all" },
			]
		: [];
	return [...dkim, ...bounce];
}

async function loadSesDomains(): Promise<SesDomainsResult> {
	try {
		const { EmailIdentities = [] } = await read(new ListEmailIdentitiesCommand({ PageSize: 100 }));
		const domains = EmailIdentities.filter((identity: any) => identity.IdentityType === "DOMAIN");
		return await Promise.all(
			domains.map(async ({ IdentityName: domain }: { IdentityName: string }) => {
				const identity = await read(new GetEmailIdentityCommand({ EmailIdentity: domain }));
				return {
					domain,
					verified: Boolean(identity.VerifiedForSendingStatus),
					dkimStatus: identity.DkimAttributes?.Status || "NOT_STARTED",
					mailFromDomain: identity.MailFromAttributes?.MailFromDomain || null,
					mailFromStatus: identity.MailFromAttributes?.MailFromDomainStatus || null,
					records: dnsRecords(domain, identity),
				};
			})
		);
	} catch (error) {
		return { error: (error as Error).message };
	}
}

export async function sendSesEmail({ from, to, replyTo, subject, html, text, headers = {}, tags = [] }: { from: string; to: string; replyTo?: string; subject: string; html: string; text: string; headers?: Record<string, string>; tags?: Array<{ name: string; value: string }> }): Promise<{ sesMessageId: string | undefined }> {
	if (!isSendingEnabled()) throw new Error("Sending is off (SENDING_ENABLED is not true)");

	const result = await getClient().send(
		new SendEmailCommand({
			FromEmailAddress: from,
			Destination: { ToAddresses: [to] },
			ReplyToAddresses: replyTo ? [replyTo] : undefined,
			ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined,
			EmailTags: tags.map(({ name, value }) => ({ Name: name, Value: value })),
			Content: {
				Simple: {
					Subject: { Data: subject, Charset: "UTF-8" },
					Body: {
						Html: { Data: html, Charset: "UTF-8" },
						Text: { Data: text, Charset: "UTF-8" },
					},
					Headers: Object.entries(headers).map(([Name, Value]) => ({ Name, Value })),
				},
			},
		})
	);
	return { sesMessageId: result.MessageId };
}
