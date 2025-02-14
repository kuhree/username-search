import { spawn } from "bun";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getConnInfo, serveStatic } from "hono/bun";
import { ipRestriction } from "hono/ip-restriction";
import { logger } from "hono/logger"
import { poweredBy } from "hono/powered-by";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";
import { stream } from "hono/streaming";
import { timing } from "hono/timing";
import { trimTrailingSlash } from "hono/trailing-slash";

import type { PlatformResult } from "./shared";
import { Layout } from "./layout";

const PORT = process.env.PORT ?? 8080
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") ?? [`http://localhost:${PORT}`]
const IP_DENY_LIST = process.env.IP_DENY_LIST?.split(",") ?? []

const app = new Hono();

// app.use(compress()) // Not supported in Bun
app.use(logger())
app.use(timing())
app.use(prettyJSON())
app.use(poweredBy())
app.use(trimTrailingSlash())
app.use(secureHeaders())
app.use(ipRestriction(getConnInfo, { denyList: IP_DENY_LIST, }))
app.use("/api/*", cors({ origin: ALLOWED_ORIGINS }))
app.use(serveStatic({
	root: "public",
	precompressed: true,
	onFound: (_path, c) => {
		c.header('Cache-Control', `public, immutable, max-age=31536000`);
	},
}));

app.get('/ping', (c) => {
	return c.text('pong');
});

app.get('/api/v1/usernames/:username', (c) => {
	const { username } = c.req.param()

	const process = spawn({
		cmd: [
			"sherlock",
			"--csv",
			"--print-all",
			"--timeout", "5",
			"--folderoutput", `public/sherlock/${username}`,
			username
		],
		stdout: "pipe",
		stderr: "pipe",
	})

	return stream(
		c,
		async (stream) => {
			const stdoutReader = process.stdout.getReader()
			const stderrReader = process.stderr.getReader()
			const decoder = new TextDecoder()
			let stdoutBuffer = ""

			stream.onAbort(() => {
				console.warn("Stream aborted! Killing process...")
				process.kill()
			})

			const processStdout = async () => {
				const testRegex = /^\[([\+\-])\]\s*(.+?):\s*(.+)$/
				const lineToJson = (line: string): PlatformResult | void => {
					const match = line.match(testRegex)
					if (match) {
						const symbol = match[1]
						const platform = match[2].trim()
						const maybeURL = match[3].trim()
						const available = symbol === '-' ? true : false

						const jsonObj: PlatformResult = {
							id: platform,
							available,
							message: "Found!",
							url: null
						}

						if (maybeURL.startsWith("http")) {
							jsonObj.url = maybeURL
						} else {
							jsonObj.message = maybeURL
						}

						return jsonObj
					}
				}

				while (true) {
					const { done, value } = await stdoutReader.read()
					if (done) break

					stdoutBuffer += decoder.decode(value, { stream: true })

					let newlineIndex
					while ((newlineIndex = stdoutBuffer.indexOf('\n')) >= 0) {
						const line = stdoutBuffer.slice(0, newlineIndex).trim()
						stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1)

						const jsonObj = lineToJson(line)
						if (jsonObj) {
							stream.write(Buffer.from(JSON.stringify(jsonObj) + "\n"))
						}
					}
				}

				if (stdoutBuffer.trim().length > 0) {
					const jsonObj = lineToJson(stdoutBuffer.trim())
					if (jsonObj) {
						stream.write(Buffer.from(JSON.stringify(jsonObj) + "\n"))
					}
				}
			}

			const processStderr = async () => {
				let errorBuffer = ''

				while (true) {
					const { done, value } = await stderrReader.read()
					if (done) break
					errorBuffer += decoder.decode(value, { stream: true })
				}

				if (errorBuffer.trim()) {
					const cleanedError = errorBuffer
						.split("\n")
						.filter(line => line.startsWith("sherlock: error:"))
						.join(" ")
						.replace(/sherlock: error: /, "")
						.trim()

					stream.write(Buffer.from(JSON.stringify({ error: cleanedError }) + "\n"))
				}
			}

			await Promise.all([processStdout(), processStderr()])
		},
		async (err, stream) => {
			stream.writeln(JSON.stringify({ error: "An error occured!" }))
			console.error("Stream error:", err)
		}
	)
});

app.get('/api/v1/usernames/:username/download', async (c) => {
	const { username } = c.req.param()
	const filePath = `public/sherlock/${username}/${username}.csv`

	try {
		const file = Bun.file(filePath)
		const exists = await file.exists()

		if (!exists) {
			return c.json({ error: 'Results not found' }, 404)
		}

		return c.body(await file.arrayBuffer(), 200, {
			'Content-Type': 'text/csv',
			'Content-Disposition': `attachment; filename="${username}_results.csv"`
		})
	} catch (error) {
		return c.json({ error: 'Failed to download results' }, 500)
	}
})

app.get("/client/entry.js", async (c) => {
	const file = await Bun.build({
		entrypoints: [`${process.cwd()}/app/client/entry.tsx`]
	})

	const outputs = await Promise.all(
		file.outputs.map((o) => o.text())
	)

	return c.body(outputs.join("\r\n"), 200, {
		"Content-Type": "application/javascript",
		"Cache-Control": "public, immutable, max-age=31536000"
	})
})

app.get('/', (c) => c.html(<Layout />));

export default {
	port: PORT,
	fetch: app.fetch
}
