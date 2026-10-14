import assert from "node:assert/strict";
import { test } from "node:test";
import { getConfigProblems } from "../lib/config.ts";
import { register } from "../instrumentation.ts";

const STRONG = { SESSION_SECRET: "s".repeat(32), ADMIN_PASSWORD: "p".repeat(12) };

test("SESSION_SECRET needs 32 characters and ADMIN_PASSWORD 12", () => {
	assert.deepEqual(getConfigProblems(STRONG as unknown as NodeJS.ProcessEnv), []);
	assert.match(getConfigProblems({ ...STRONG, SESSION_SECRET: "s".repeat(31) } as unknown as NodeJS.ProcessEnv).join(), /SESSION_SECRET must be at least 32/);
	assert.match(getConfigProblems({ ...STRONG, ADMIN_PASSWORD: "p".repeat(11) } as unknown as NodeJS.ProcessEnv).join(), /ADMIN_PASSWORD must be at least 12/);
	assert.equal(getConfigProblems({} as unknown as NodeJS.ProcessEnv).length, 2, "missing counts as too short");
});

test("the server doesn't start with a short secret or password", () => {
	const previous = { ...process.env };
	try {
		Object.assign(process.env, STRONG);
		assert.doesNotThrow(register);
		process.env.ADMIN_PASSWORD = "short";
		assert.throws(register, /Mailcheap can't start\. ADMIN_PASSWORD must be at least 12 characters/);
		Object.assign(process.env, STRONG, { SESSION_SECRET: "short" });
		assert.throws(register, /SESSION_SECRET must be at least 32 characters/);
	} finally {
		process.env = previous;
	}
});
