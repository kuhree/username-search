import { Hono } from 'hono'

const ERRORS = {
	1000: "Request failed to fetch",
	1001: "Invalid adapter method",
	1002: "Invalid adapter",
	1003: "Invalid username",
	1004: "Invalid retries",
	9000: "Not yet implemented"
}

type CheckUsernameResponse =
	| { available: "unknown" }
	| { available: true }
	| {
		available: false
		createdAt: Date | null
		updatedAt: Date | null
		email: string | null
		avatar: string | null
		followers: number | null
		following: number | null
	}

type PlatformAdapter = {
	id: string
	headers: null | HeadersInit
	url: string
	methods: Array<"api" | "sherlock">
	transformer: (response: any) => CheckUsernameResponse
}

type CheckUsernameOptions = {
	username: string
	methodsRemaining: number
	adapter: PlatformAdapter
}

const ADAPTERS: { [platform: string]: PlatformAdapter } = {
	github: {
		id: "github",
		headers: null,
		url: "https://api.github.com/users/{username}",
		methods: ["api", "sherlock"],
		transformer: (response: any): CheckUsernameResponse => {
			if (!Boolean(response.id)) {
				return { available: true }
			}

			return {
				available: false,
				createdAt: response.created_at ? new Date(response.created_at) : null,
				updatedAt: response.updated_at ? new Date(response.updated_at) : null,
				email: response.email ?? null,
				avatar: response.avatar_url ?? null,
				followers: response.followers ?? null,
				following: response.following ?? null,
			}
		}
	},

	reddit: {
		id: "reddit",
		headers: null,
		url: "https://www.reddit.com/user/{username}/about.json",
		methods: ["api", "sherlock"],
		transformer: (response: any): CheckUsernameResponse => {
			if (!Boolean(response.data.id)) {
				return { available: true }
			}

			return {
				available: false,
				createdAt: response.data.created ? new Date(response.data.created) : null,
				updatedAt: null,
				email: null,
				avatar: response.data.icon_img ?? null,
				followers: null,
				following: null,
			}
		}
	}
} as const

async function checkApi(
	opts: Pick<CheckUsernameOptions, "username" | "adapter">,
) {
	const { username, adapter } = opts
	const { url, headers, } = adapter

	const response = await fetch(
		url.replace("{username}", username),
		{
			headers: headers ?? undefined
		}
	);

	if (!response.ok) {
		const cause = await response.json()
		console.warn(ERRORS[1000], { cause })
		throw new Error(ERRORS[1000], { cause })
	}

	return response.json()
}

async function checkUsername(opts: CheckUsernameOptions): Promise<CheckUsernameResponse> {
	const { username, methodsRemaining, adapter } = opts
	if (methodsRemaining <= 0 || methodsRemaining > adapter.methods.length) {
		throw new Error(ERRORS[1004], { cause: `Methods remaining is not within range (remaining = ${methodsRemaining}, range = [0,${adapter.methods.length}])` })
	}

	let response: CheckUsernameResponse = { available: "unknown" }
	let error: unknown
	switch (adapter.methods.toReversed()[methodsRemaining - 1]) {
		case "api": {
			try {
				const apiResponse = await checkApi(opts)
				response = adapter.transformer(apiResponse)
				break;
			} catch (e) {
				if (error instanceof Error && error.cause instanceof Error && (error.cause.message == "Not Found" || error.cause.error == 404)) {
					response = { available: true }
					break;
				}

				error = e
				break;
			}
		}

		case "sherlock": {
			response = { available: "unknown" }
			error = new Error(ERRORS[9000], { cause: `Method not yet implemented (${adapter.methods[methodsRemaining]})` })
			break;
		}

		default: {
			response = { available: "unknown" }
			error = new Error(ERRORS[1001], { cause: `Unexpected method (${adapter.methods[methodsRemaining]})` })
			break
		}
	}

	if (error && ((methodsRemaining - 1) > 0)) {
		console.warn("Error occurred while checking username. Trying next method...\r\n", {
			username,
			adapter,
			methodsRemaining: methodsRemaining - 1,
			error
		})

		response = await checkUsername({ ...opts, methodsRemaining: methodsRemaining - 1 })
	} else if (error) {
		console.warn("Error occurred while checking username. Exiting...\r\n", {
			username,
			adapter,
			methodsRemaining: methodsRemaining - 1,
			error
		})
	}

	if (!response) {
		throw new Error(ERRORS[1000], { cause: `Username check failed to return a response (username = ${username}, adapter = ${adapter.id})` })
	}

	return response
}

const app = new Hono()

app.get('/ping', (c) => {
	return c.text('pong')
})

app.on(["GET"], '/api/channels/:channel/:username', async (c) => {
	const { channel, username } = c.req.param()
	if (!(channel in ADAPTERS)) {
		throw new Error(ERRORS[1002], { cause: `Adapter was not found for channel (${channel})` })
	} else if (!username) {
		throw new Error(ERRORS[1003], { cause: `Username was not valid (${username})` })
	}

	const result = await checkUsername({ username, methodsRemaining: ADAPTERS[channel].methods.length, adapter: ADAPTERS[channel] })
	return Response.json(result)
})

export default app
