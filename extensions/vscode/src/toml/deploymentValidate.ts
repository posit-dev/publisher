// Copyright (C) 2026 by Posit Software, PBC.

import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

import configSchema from "./schemas/posit-publishing-schema-v3.json";
import recordSchema from "./schemas/posit-publishing-record-schema-v3.json";

// The record schema has a $ref to the config schema, so we must register
// the config schema first so AJV can resolve the reference.
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(configSchema);
export const validateDeploymentRecord = ajv.compile(recordSchema);
