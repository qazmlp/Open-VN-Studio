/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright 2023 Qazm
 */

import { Serializable } from "./serde.mjs";

interface Step {
	namespace?: string,
	type: string,
	args?: any,
}

const __keytype__ = Symbol();
type Key<Name extends string> = string & { [__keytype__]: Name };

// These keys starting with `K` are technically strings... but for ease of correctness they'll mostly
// be treated as opaque identifiable tokens with distinct types.
type KPose = Key<'Pose'>;

type Listing = Step[];