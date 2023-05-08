/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright 2023 Qazm
 */

import { INIT, Obj } from "./common.js";
import { InvalidOperationError } from "./errors.js";

/** @type {Map<string, any>} */
const singletons = new Map();
/** @type {Map<any, string>} */
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

// `{}`-style objects are allowed as special exception.
registerSingleton(Object.name, Object);

/** @template T */
export function setEnumerable(
	/** @type {T} */ o,
	/** @type {(keyof T & string | 'constructor')[]} */ ...keys
) {
	for (const key of keys) {
		if (!Object.getOwnPropertyDescriptor(o, key)) {
			throw new TypeError(`Tried to make missing property ${JSON.stringify(key)} enumerable.`);
		}
		Object.defineProperty(o, key, { enumerable: true, });
	}
}

/** @template T */
export function setupSerializable(
	/** @type {new () => T} */ c,
	/** @type {(keyof T & string)[]} */ ...extraKeys
) {
	registerSingleton(c.name, c);
	setEnumerable(c.prototype, 'constructor', ...extraKeys);
}

/**
 * Note: If there are extra keys during deserialisation, those aren't lost but will
 * show up as enumerable own properties on the deserialised object. This should prevent
 * data loss when loading saves in an older version of a game, and allows the use of
 * dictionary-style records, but it could cause issues if names are reused with different
 * meaning later on.
 */
export class Serializable extends Obj {
	constructor() {
		super();
		Serializable.prototype[INIT].apply(this);
	}

	/** @overload */
	[INIT]() { /* Empty. */ }
}
registerSingleton(Serializable.name, Serializable);

export class SerializableValue extends Obj { }

/**
 * @typedef {`b${string}`} BigIntValue
 * @typedef {BigIntValue | number | `_${string}` | boolean | null} Value
 * @typedef {`s${string}`} SingletonLink
 * @typedef {'' | `.${string}`} ObjectLink
 * @typedef {`rs${string}`} RegisteredSymbolLink
 * @typedef {SingletonLink | ObjectLink | RegisteredSymbolLink} Link
 * @typedef {Value | Link} SerializedPropertyValue
 */

/**
 * @typedef {Record<string, SerializedPropertyValue>} SerializedObject
 */

export function serialize(
		/** @type{any} */ value,
) {
	/** @type {Record<Exclude<ObjectLink, ''>, SerializedObject> & {'': SerializedPropertyValue | SerializedObject}} */
	const target = {};
	const serialisedValue = serializeValue(value, target, new Map(), '');
	if (serialisedValue !== '') {
		target[''] = serialisedValue;
	}
	return target;
}

/** @returns {SerializedPropertyValue} */
export function serializeValue(
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
		} else if (value instanceof Serializable || value.constructor === Object) {
			valueMap.set(value, objectKey);

			const sO = target[objectKey] = {};
			if (value.constructor === Object) {
				sO[''] = serializeValue(Object, target, valueMap, `${objectKey}.`);
			}
			for (let key in value) {
				let sOKey = key;
				switch (key) {
					// Space-saving measure.
					case 'constructor': sOKey = ''; break;
					case '': sOKey = 'constructor'; break;
					default: break;
				}
				if (Object.getOwnPropertyDescriptor(sO, sOKey)) {
					throw new TypeError(`Duplicate serialized property key in ${value}: ${key}`);
				}
				sO[sOKey] = serializeValue(value[key], target, valueMap, `${objectKey}.${key.replaceAll(/(\.|\\)/g, '\\$1')}`);
			}
			return objectKey;
		} else if (value instanceof Array) {
			valueMap.set(value, objectKey);
			target[objectKey] = value.map((x, i) => serializeValue(x, target, valueMap, `${objectKey}.${i}`));
			return objectKey;
		} else {
			throw new TypeError(`Unserialisable value encountered: ${value}`);
		}
	}
}

export function deserialize(
		/** @type {Record<Exclude<ObjectLink, ''>, SerializedObject> & {'': SerializedPropertyValue | SerializedObject}} */ source,
) {
	const root = source[''];
	if (typeof root === 'object' && !(root === null)) {
		return deserializeObject(root, source, new Map(), '');
	} else {
		return deserializeValue(root, source, new Map());
	}
}

export function deserializeValue(
		/** @type {SerializedPropertyValue} */ serializedValue,
		/** @type {Record<Exclude<ObjectLink, ''>, SerializedObject>} */ source,
		/** @type {Map<string, any>} */ valueMap,
) {
	switch (typeof serializedValue) {
		case 'boolean':
		case 'number':
			return serializedValue;

		case 'string': if (serializedValue.startsWith('_')) {
			return serializedValue.slice('_'.length);
		} else if (serializedValue.startsWith('s')) {
			const key = serializedValue.slice('s'.length);
			const value = singletons.get(key);
			if (value === undefined && !singletons.has(key)) {
				throw new TypeError(`Missing singleton for key ${JSON.stringify(key)}.`);
			}
			return value;
		} else if (serializedValue.startsWith('.')) {
			return deserializeObject(source[serializedValue], source, valueMap, serializedValue);
		} else if (serializedValue.startsWith('rs')) {
			return Symbol.for(serializedValue.slice('rs'.length));
		} else if (serializedValue.startsWith('b')) {
			return BigInt(serializedValue.slice('b'.length));
		} else {
			throw new TypeError(`Unrecognised string value ${JSON.stringify(serializedValue)} in serialised object.`);
		}

		default:
			break;
	}
}

export function deserializeObject(
		/** @type {SerializedObject} */ serializedObject,
		/** @type {Record<Exclude<ObjectLink, ''>, SerializedObject>} */ source,
		/** @type {Map<string, any>} */ valueMap,
		/** @type {string} */ objectKey,
) {
	{
		const wipObject = valueMap.get(objectKey);
		if (wipObject) return wipObject;
	}

	if (serializedObject instanceof Array) {
		return serializedObject.map(x => deserializeValue(x, source, valueMap));
	}

	const constructor = deserializeValue(serializedObject[''], source, valueMap);

	const object = new constructor;
	valueMap.set(objectKey, object);

	for (let key in serializedObject) {
		switch (key) {
			case '': continue;
			case 'constructor': key = ''; break;
			default: break;
		}
		object[key] = deserializeValue(serializedObject[key], source, valueMap);
	}

	return object;
}

export function deepClone(
	/** @type {any} */ v,
) {
	return deserialize(serialize(v));
}
