import {AbstractDomainModule} from 'web_audit/dist/domain/AbstractDomainModule.js';
import {ModuleEvents} from 'web_audit/dist/modules/ModuleInterface.js';
import schema from "./mozilla_observatory.schema.json" with {type: "json"};

/**
 * Mozilla Observatory Module events.
 */
export const MozillaObservatoryModuleEvents = {
	createMozillaObservatoryModule: 'mozilla_observatory_module__createMozillaObservatoryModule',
	onResult: 'mozilla_observatory_module__onResult',
};

/**
 * Mozilla Observatory Validator.
 */
export default class MozillaObservatoryModule extends AbstractDomainModule {

	/**
	 * {@inheritdoc}
	 */
	get name() {
		return 'Mozilla Observatory';
	}

	/**
	 * {@inheritdoc}
	 */
	get id() {
		return `mozilla_observatory`;
	}

	/**
	 * {@inheritdoc}
	 */
	getSchema() {
		return schema;
	}

	/**
	 * {@inheritdoc}
	 */
	async init(context) {
		this.context = context;

		// Install store.
		this.context.config.storage?.installSchema(this, this.context);

		// Emit.
		this.context.eventBus.emit(MozillaObservatoryModuleEvents.createMozillaObservatoryModule, {module: this});
	}

	/**
	 * {@inheritdoc}
	 */
	async analyseDomain(urlWrapper) {
		try {
			this.context?.eventBus.emit(ModuleEvents.startsComputing, {module: this});

			const result = await this.getBaseResult(urlWrapper.url.hostname);

			if (!result.status_code) {
				this.context?.eventBus.emit(ModuleEvents.endsComputing, {module: this});

				this.context?.config?.logger.error(`Mozilla Observatory: Bad ressponse`);
				return false;
			}

			result.tests = await this.getTestResults(result?.scan_id);

			result.url = urlWrapper.url.hostname;

			const summary = {
				url: urlWrapper.url.hostname,
				grade: result.grade,
				score: result.score,
				tests_failed: result.tests_failed,
				tests_passed: result.tests_passed,
			};

			this.context?.eventBus.emit(MozillaObservatoryModuleEvents.onResult, {
				module: this,
				url: urlWrapper,
				result: result,
			});
			this.context?.eventBus.emit(ModuleEvents.onAnalyseResult, {module: this, url: urlWrapper, result: result});

			this.context?.config?.logger.result(this.name, summary, urlWrapper.url.toString());
			// @ts-ignore
			this.context?.config?.storage?.one(this, 'mozilla_observatory', this.context, result);

			this.context?.eventBus.emit(ModuleEvents.endsComputing, {module: this});

			return true;
		} catch (err) {
			if(this.context?.config?.AppConfig?.getConfig().verbose){
				console.log(err);
			}
			return false;
		}
	}

	/**
	 * Return base result.
	 * @param domain
	 * @returns {Promise<void>}
	 */
	async getBaseResult(domain) {
		const endpoint = `https://observatory-api.mdn.mozilla.net/api/v2/scan?host=${domain}`;
		const data = {
			hidden: true,
		};

		const customHeaders = {
			'Content-Type': 'application/json', // eslint-disable-line @typescript-eslint/naming-convention
		};

		const response = await fetch(endpoint, {
			method: 'POST',
			headers: customHeaders,
			body: JSON.stringify(data),
		});

		return response.json();
	}

	/**
	 * Return test details.
	 *
	 * @returns {Promise<void>}
	 */
	async getTestResults(scanId) {
		if (scanId) {
			const endpoint = `https://http-observatory.security.mozilla.org/api/v1/getScanResults?scan=${scanId}`;
			const response = await fetch(endpoint, {
				method: 'GET',
			});

			const val = await response.json();
			return JSON.stringify(val);
		}
		return null;
	}

	/**
	 * {@inheritdoc}
	 */
	finish() {
	}

}
