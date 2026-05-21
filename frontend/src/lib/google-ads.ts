interface FireGoogleAdsConversionOptions {
	sendTo: string;
	dedupeKey: string;
	transactionId?: string;
}

export function fireGoogleAdsConversion(options: FireGoogleAdsConversionOptions): void {
	const sendTo = options.sendTo.trim();
	if (!sendTo) return;
	if (sessionStorage.getItem(options.dedupeKey)) return;

	window.gtag?.('event', 'conversion', {
		send_to: sendTo,
		...(options.transactionId ? { transaction_id: options.transactionId } : {})
	});
	sessionStorage.setItem(options.dedupeKey, '1');
}
