// Copyright (C) 2026 by Posit Software, PBC.

import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

import schema from "./schemas/posit-publishing-schema-v3.json";

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
export const validate = ajv.compile(schema);
