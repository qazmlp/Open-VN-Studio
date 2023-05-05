import { Obj } from "./common.js";
import { InvalidOperationError } from "./errors.js";

const singletons = new Map();
const reverseSingletons = new Map();
export function registerSingleton(
	/** @type {string} */ key,
	/** @type {object} */ value,
) {
	if (singletons.has(key) && singletons.get(key) !== value) {
		console.error("Duplicate serialization singleton: Registering", value, "as", key, "which was already assigned to", singletons.get(key));
		throw new InvalidOperationError("Singleton with this key already exists.");
	}
	singletons.set(key, value);
	reverseSingletons.set(value, key);
}

// These are common values that aren't handled well by JSON.
// They are loaded up as singletons instead, and have secial handling when serialising.
singletons.set("undefined", undefined);
singletons.set("NaN", NaN);
singletons.set("Infinity", Infinity);
singletons.set("-Infinity", -Infinity);

const customs = new Map();
export function registerCustom(
	/** @type {string} */ key,
	/** @type {(deserializer: Deserializer, source: Record<ObjectLink, SerializedObject>, valueMap: Map<string, any>, ...params: any[]) => any} */ restore,
) {
	if (customs.has(key) && customs.get(key) !== restore) {
		console.error("Duplicate custom deserialiser: Registering", restore, "as", key, "which was already assigned to", singletons.get(key));
		throw new InvalidOperationError("Custom deserialiser with this key already exists.");
	}
}

export class Serializable extends Obj {
	get serializedKeys() { return ['constructor']; }
}
registerSingleton(Serializable.name, Serializable);

export class SerializableValue extends Obj { }

/**
 * @typedef {`b${string}`} BigIntValue
 * @typedef {[string, ...any[]]} CustomValue
 * @typedef {BigIntValue | number | `_${string}` | boolean | null | CustomValue} Value
 * @typedef {`s${string}`} SingletonLink
 * @typedef {'' | `.${string}`} ObjectLink
 * @typedef {`rs${string}`} RegisteredSymbolLink
 * @typedef {SingletonLink | ObjectLink | RegisteredSymbolLink} Link
 * @typedef {Value | Link} SerializedPropertyValue
 */

/**
 * @typedef {Record<string, SerializedPropertyValue>} SerializedObject
 */

export class Serializer {
	static serialize(
		/** @type{any} */ value,
	) {
		/** @type {Record<Exclude<ObjectLink, ''>, SerializedObject> & {'': SerializedPropertyValue | SerializedObject}} */
		const target = {};
		const serialisedValue = this.serializeInto(value, target, new Map(), '');
		if (serialisedValue !== '') {
			target[''] = serialisedValue;
		}
		return target;
	}

	/** @returns {SerializedPropertyValue} */
	static serializeInto(
		/** @type{any} */ value,
		/** @type {Record<Exclude<ObjectLink, ''>, SerializedObject>} */ target,
		/** @type {Map<object, string>} */ valueMap,
		/** @type {'' | `.${string}`} */ objectKey,
	) {
		switch (typeof value) {
			case 'bigint': return `b${value.toString()}`;
			case 'boolean': return value;
			case 'number': {
				switch (value) {
					case Infinity: return 'sInfinity';
					case -Infinity: return 's-Infinity';
					default:
						if (Number.isNaN(value)) return 'sNaN';
						return value;
				}
			}

			case 'string': return `_${value}`;
			case 'symbol': {
				const key = Symbol.keyFor(value);
				if (key === undefined) {
					throw new TypeError(`Only registered symbols can be serialised. Tried to serialise: ${value.toString()}`);
				}
				return `rs${key}`;
			}
			case 'undefined': return 'sundefined';
			case 'object':
				if (value === null) return value; // else fallthrough.
			case 'function':
			default: if (reverseSingletons.has(value)) {
				return `s${reverseSingletons.get(value)}`;
			} else if (value instanceof SerializableValue) {
				throw new Error("//TODO");
			} else if (value instanceof Serializable) {
				valueMap.set(value, objectKey);

				const sO = target[objectKey] = {};
				for (let key of value.serializedKeys) {
					let sOKey = key;
					switch (key) {
						// Space-saving measure.
						case 'constructor': sOKey = ''; break;
						case '': sOKey = 'constructor'; break;
						default: break;
					}
					if (Object.getOwnPropertyDescriptor(sO, sOKey)) {
						throw new TypeError(`Duplicate serialized property key: ${key}`);
					}
					sO[sOKey] = this.serializeInto(value[key], target, valueMap, `${objectKey}.${key}`);
				}
				return `${objectKey}`;
			} else if (value instanceof Array) {
				valueMap.set(value, objectKey);
				target[objectKey] = ['Array', ...value.map((x, i) => this.serializeInto(x, target, valueMap, `${objectKey}.${i}`))];
				return `${objectKey}`;
			} else {
				throw new TypeError(`Unserialisable value encountered: ${value}`);
			}
		}
	}
}