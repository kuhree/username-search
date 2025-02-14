export function Layout() {
	return (
		<html>
			<head>
				<meta charSet="utf-8" />
				<meta content="width=device-width, initial-scale=1" name="viewport" />
				<link rel="stylesheet" href="/static/monospace-web/reset.css" />
				<link rel="stylesheet" href="/static/monospace-web/index.css" />
				<link rel="stylesheet" href="/static/styles/index.css" />
				<title>Username Search</title>
			</head>

			<body>
				<header class="header">
					<table class="width-auto">
						<tbody>
							<tr>
								<td>
									<h1 class="title">Username Search</h1>
									<span class="subtitle">Check username availability across platforms</span>
								</td>
							</tr>
						</tbody>
					</table>
				</header>

				<hr />

				<noscript>
					<p>This site requires javascript to run. Please enable javascript and try again.</p>
				</noscript>
				<main id="root" />

				<hr />

				<footer>
					<h2>Powered By</h2>
					<ul>
						<li>
							Username checking -&gt;{' '}
							<a href="https://github.com/sherlock-project/sherlock">
								<cite>Sherlock</cite>
							</a>
						</li>
						<li>
							Styling -&gt;{' '}
							<a href="https://owickstrom.github.io/the-monospace-web/">
								<cite>The Monospace Web</cite>
							</a>
						</li>
						<li>
							Favicon -&gt;{' '}
							<a href="https://github.com/twitter/twemoji">
								<cite>Twemoji</cite>
							</a>
						</li>
						<li>
							JS Runtime -&gt;{' '}
							<a href="https://bun.sh">
								<cite>Bun</cite>
							</a>
						</li>
						<li>
							Web Framework -&gt;{' '}
							<a href="https://hono.dev">
								<cite>Hono</cite>
							</a>
						</li>
					</ul>

					<h2>
						Created By{' '}
						<a href="https://kuhree.com">
							<cite>Kuhree</cite>
						</a>
					</h2>

					<p>
						I built this site to have an easier way to check for usernames across different platforms (and I wanted to try Bun+Hono).
						If you like the site or have a suggestion feel free to <a href="mailto:hi@kuhree.com">say hello</a>.
						Feedback is always appreciated! Thank you for visiting.
					</p>
				</footer>

				<script async type="text/javascript" src="/static/monospace-web/index.js" />
				<script type="text/javascript" src="/client/entry.js" />
			</body>
		</html>
	)
}
