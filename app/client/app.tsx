import { useState, useEffect, useRef } from "hono/jsx";
import type { PlatformResult } from "../shared";

export function App() {
	const [username, setUsername] = useState<string>('')
	const [results, setResults] = useState<PlatformResult[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const abortControllerRef = useRef<AbortController | null>(null)

	const handleUsername = async (e: Event) => {
		const newUsername = (e.target as HTMLInputElement).value
		window.history.replaceState({}, "", `?username=${newUsername}`)
		setUsername(newUsername)
		setResults([])
		setError(null)
	}

	const handleSubmit = async (e: Event) => {
		e.preventDefault()
		if (!username.trim()) return

		setIsLoading(true)
		setError(null)
		setResults([])

		if (abortControllerRef.current) {
			abortControllerRef.current.abort()
		}

		const controller = new AbortController()
		abortControllerRef.current = controller

		try {
			const response = await fetch(`/api/v1/usernames/${encodeURIComponent(username)}`, {
				signal: controller.signal,
			})

			if (!response.ok) throw new Error("Internal Server Error")
			if (!response.body) throw new Error('No response body')

			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let buffer = ''

			while (true) {
				const { done, value } = await reader.read()
				if (done) break

				buffer += decoder.decode(value)
				const lines = buffer.split('\n')

				buffer = lines.pop() || ''

				for (const line of lines) {
					if (!line.trim()) continue

					try {
						const data = JSON.parse(line)
						if (data.error) {
							setError(data.error)
							controller.abort()
							return
						}

						setResults(prev => [...prev, data])
					} catch (err) {
						console.error('Error parsing JSON:', err)
					}
				}
			}
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') {
				console.log('Request aborted')
			} else {
				setError(err instanceof Error ? err.message : 'Unknown error occurred')
			}
		} finally {
			setIsLoading(false)
			abortControllerRef.current = null
		}
	}

	const handleDownload = async () => {
		try {
			const response = await fetch(`/api/v1/usernames/${encodeURIComponent(username)}/download`)
			if (!response.ok) {
				const error = await response.json()
				throw new Error(error.error || 'Download failed')
			}

			const blob = await response.blob()
			const url = window.URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `${username}_results.csv`
			document.body.appendChild(a)
			a.click()
			window.URL.revokeObjectURL(url)
			document.body.removeChild(a)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Download failed')
		}
	}

	useEffect(() => {
		const urlSearchParams = new URLSearchParams(window.location.search)
		const urlUsername = urlSearchParams.get('username')
		if (urlUsername) setUsername(urlUsername)

		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort()
			}
		}
	}, [])

	return (
		<>
			<form onSubmit={handleSubmit}>
				<input
					id="username"
					class="width-auto"
					type="text"
					tabindex={1}
					disabled={isLoading}
					value={username}
					onChange={handleUsername}
					placeholder="Enter username to check"
				/>

				<div class="form-actions">
					{isLoading === false && results.length > 0 && (
						<button
							type="button"
							onClick={handleDownload}
						>
							[ Download Results ]
						</button>
					)}

					<button
						type="submit"
						tabindex={2}
						disabled={isLoading || !username.trim()}
					>
						{isLoading ? '[ Checking... ]' : '[ Check Availability ]'}
					</button>
				</div>

				<div class="form-status">
					{error && (
						<pre>
							[!] Error: {error}
						</pre>
					)}
					{isLoading && (
						<pre>
							[*] Checking username: {username}
							{Array(3).fill('.').map((dot, i) => (
								<span key={i} style={{ animation: `blink 1s ${i * 0.3}s infinite` }}>.</span>
							))}
						</pre>
					)}
					{!isLoading && results.length === 0 && !error && (
						<pre>
							[?] Enter a username above to begin search
						</pre>
					)}
				</div>
			</form>

			{results.length > 0 && (
				<div>
					<div>
						<h2>[+] Found</h2>
						<ul>
							{results
								.filter(result => !result.available)
								.map((result) => (
									<li key={result.id}>
										<pre>[+] {result.id} {result.message && result.message}</pre>
										<div>
											{result.url && (
												<a
													href={result.url}
													target="_blank"
													rel="noopener noreferrer"
												>
													{result.url}
												</a>
											)}
										</div>
									</li>
								))}
						</ul>
					</div>

					<div>
						<h2>[-] Not Found</h2>
						<ul>
							{results
								.filter(result => result.available)
								.map((result) => (
									<li key={result.id}>
										<pre>[-] {result.id} {result.message && result.message}</pre>
									</li>
								))}
						</ul>
					</div>
				</div>
			)}
		</>
	)
}
