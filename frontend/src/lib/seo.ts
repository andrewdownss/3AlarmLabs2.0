export const siteOrigin = 'https://3alarmlabs.com';
export const siteName = '3AlarmLabs';
export const defaultSeoTitle = '3AlarmLabs | Fire Command Training Software';
export const defaultSeoDescription =
	'Self-paced fire command training software for firefighters and departments to practice incident command, radio communication, size-up, and after-action review.';
export const defaultOgImageUrl = 'https://hero.3alarmlabs.com/Ind-View.png';

export function toCanonicalUrl(path = '/'): string {
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	return normalizedPath === '/' ? siteOrigin : `${siteOrigin}${normalizedPath}`;
}

export function toJsonLd(value: unknown): string {
	return JSON.stringify(value).replace(/</g, '\\u003c');
}

export const organizationJsonLd = {
	'@context': 'https://schema.org',
	'@type': 'Organization',
	name: siteName,
	url: siteOrigin,
	logo: defaultOgImageUrl,
	contactPoint: [
		{
			'@type': 'ContactPoint',
			email: 'andrew@3alarmlabs.com',
			contactType: 'customer support',
			areaServed: 'US',
			availableLanguage: 'en'
		},
		{
			'@type': 'ContactPoint',
			email: 'andrew@3alarmlabs.com',
			contactType: 'sales',
			areaServed: 'US',
			availableLanguage: 'en'
		}
	]
};

export const websiteJsonLd = {
	'@context': 'https://schema.org',
	'@type': 'WebSite',
	name: siteName,
	url: siteOrigin,
	description: defaultSeoDescription,
	publisher: {
		'@type': 'Organization',
		name: siteName,
		url: siteOrigin
	}
};

export function softwareApplicationJsonLd(monthlyPrice: number) {
	return {
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: siteName,
		applicationCategory: 'EducationalApplication',
		operatingSystem: 'Web',
		url: siteOrigin,
		description: defaultSeoDescription,
		offers: {
			'@type': 'Offer',
			price: monthlyPrice.toFixed(2),
			priceCurrency: 'USD',
			availability: 'https://schema.org/InStock',
			url: toCanonicalUrl('/pricing')
		},
		audience: {
			'@type': 'Audience',
			audienceType: 'Firefighters, fire officers, training officers, and fire departments'
		}
	};
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: items.map((item) => ({
			'@type': 'Question',
			name: item.question,
			acceptedAnswer: {
				'@type': 'Answer',
				text: item.answer
			}
		}))
	};
}
