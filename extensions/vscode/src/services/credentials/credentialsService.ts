// Copyright (C) 2025 by Posit Software, PBC.

import { Credential, CreateCredentialDetails } from "./types";

/**
 * CredentialsService provides methods for managing credentials.
 * This interface matches the Go CredentialsService interface.
 */
export interface CredentialsService {
  /**
   * Delete removes a Credential by its guid.
   * @throws NotFoundError if the credential is not found.
   */
  delete(guid: string): Promise<void>;

  /**
   * Get retrieves a Credential by its guid.
   * @throws NotFoundError if the credential is not found.
   */
  get(guid: string): Promise<Credential>;

  /**
   * List retrieves all Credentials.
   */
  list(): Promise<Credential[]>;

  /**
   * Set creates or updates a Credential.
   * A guid is assigned to the Credential using UUIDv4 specification.
   * @throws NameCollisionError if a credential with the same name exists.
   * @throws IdentityCollisionError if a credential with the same URL exists.
   * @throws IncompleteCredentialError if required fields are missing.
   */
  set(details: CreateCredentialDetails): Promise<Credential>;

  /**
   * ForceSet is like Set but doesn't check for conflicts with existing credentials.
   * Used for migration and updating existing credentials.
   */
  forceSet(details: CreateCredentialDetails): Promise<Credential>;

  /**
   * Reset clears all credentials from storage.
   * For file storage, returns the backup file path.
   * For keyring storage, returns empty string (no backup possible).
   */
  reset(): Promise<string>;
}
