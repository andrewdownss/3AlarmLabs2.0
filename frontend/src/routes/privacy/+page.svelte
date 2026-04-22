<script lang="ts">
	import { LandingFooter, LandingHeader } from '$lib/components/landing';
	import { PLANS } from '$lib/plans';

	const monthlyPrice = PLANS.individual.monthlyPrice ?? 29;

	const lastUpdated = 'April 21, 2026';
</script>

<svelte:head>
	<title>Privacy Policy — 3 Alarm Labs</title>
	<meta
		name="description"
		content="How 3 Alarm Labs collects, uses, and protects data from firefighters and departments using our command training software."
	/>
	<link rel="canonical" href="https://3alarmlabs.com/privacy" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content="Privacy Policy — 3 Alarm Labs" />
	<meta
		property="og:description"
		content="How 3 Alarm Labs collects, uses, and protects data from firefighters and departments."
	/>
	<meta property="og:url" content="https://3alarmlabs.com/privacy" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div class="min-h-screen bg-muted/25 text-foreground">
	<div class="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
		<LandingHeader {monthlyPrice} />

		<main class="py-12 sm:py-16">
			<article class="mx-auto max-w-3xl rounded-none bg-background px-4 py-10 sm:px-10 sm:py-12">
				<header>
					<p class="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Legal</p>
					<h1 class="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
						Privacy Policy
					</h1>
					<p class="mt-3 text-sm text-muted-foreground">Last updated {lastUpdated}</p>
				</header>

				<div class="prose prose-slate mt-10 max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-[#E85D20] hover:prose-a:text-[#D4501A] prose-a:no-underline hover:prose-a:underline">
					<p>
						This policy explains what data 3 Alarm Labs collects when you use our command training software,
						how we use it, and the choices you have. By using 3 Alarm Labs you agree to this policy.
					</p>

					<h2>Who we are</h2>
					<p>
						3 Alarm Labs provides fire command training software for individual firefighters, departments,
						academies, and training companies. We are the data controller for information collected through our
						website and applications.
					</p>

					<h2>Information we collect</h2>
					<ul>
						<li>
							<strong>Account data</strong> — name, email, password hash, department or organization affiliation,
							and role.
						</li>
						<li>
							<strong>Training content</strong> — scenarios, scenes, and session events you create, along with
							assignments, transcripts, and decisions recorded during scenarios.
						</li>
						<li>
							<strong>Voice audio</strong> — radio audio captured during Command sessions for transcription and
							parsing. Do not upload recordings that must remain confidential under law or department policy
							without authorization.
						</li>
						<li>
							<strong>Billing data</strong> — name, billing address, and payment details handled by Stripe. We do
							not store full card numbers on our servers.
						</li>
						<li>
							<strong>Usage data</strong> — log data, device and browser information, pages visited, and errors, to
							operate and improve the service.
						</li>
					</ul>

					<h2>How we use information</h2>
					<ul>
						<li>Run training scenarios and sessions, including real-time radio transcription and parsing.</li>
						<li>Let instructors and learners review decisions, transcripts, and audio after a session.</li>
						<li>Operate accounts, process payments, and provide support.</li>
						<li>Monitor performance, prevent abuse, and improve the product.</li>
						<li>Send transactional emails (for example, account verification or billing receipts).</li>
					</ul>

					<h2>Third-party services</h2>
					<p>
						We use third-party vendors to operate the service. These include:
					</p>
					<ul>
						<li>Hosting and infrastructure providers.</li>
						<li>Speech-to-text and language-model providers used for radio transcription and parsing.</li>
						<li>Payment processing (Stripe).</li>
						<li>Email delivery for transactional messages.</li>
						<li>Analytics and performance monitoring.</li>
					</ul>
					<p>
						We select vendors who offer reasonable security and privacy commitments. Voice audio used for
						transcription may be processed briefly by these providers to return a transcript.
					</p>

					<h2>Data retention</h2>
					<p>
						We retain account data for as long as your account is active. Training content (scenarios, session
						events, transcripts, and audio) is retained so you can review past sessions. You can delete specific
						content from within the app. When you delete your account, we delete or anonymize associated data
						within a reasonable period, subject to legal or accounting retention requirements.
					</p>

					<h2>Security</h2>
					<p>
						We use encryption in transit, access controls, and standard operational safeguards. No system is
						perfectly secure, and we encourage you to use strong passwords and not to upload confidential or
						legally protected recordings without authorization.
					</p>

					<h2>Your choices</h2>
					<ul>
						<li>Review and update your account information in Settings.</li>
						<li>Delete specific scenarios, scenes, or sessions from within the app.</li>
						<li>
							Email <a href="mailto:privacy@3alarmlabs.com">privacy@3alarmlabs.com</a> to request a copy or deletion
							of personal data, or to ask questions about this policy.
						</li>
					</ul>

					<h2>Children</h2>
					<p>
						3 Alarm Labs is intended for professional firefighters and training organizations. It is not directed
						at children under 13 and we do not knowingly collect data from children.
					</p>

					<h2>Changes to this policy</h2>
					<p>
						We may update this policy. When we make material changes, we will update the "last updated" date and,
						where appropriate, notify you in the app or by email.
					</p>

					<h2>Contact</h2>
					<p>
						Privacy questions: <a href="mailto:privacy@3alarmlabs.com">privacy@3alarmlabs.com</a>.<br />
						General support: <a href="mailto:support@3alarmlabs.com">support@3alarmlabs.com</a>.
					</p>
				</div>
			</article>
		</main>

		<LandingFooter />
	</div>
</div>
