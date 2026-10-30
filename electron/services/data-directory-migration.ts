import { cpSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Result of attempting to migrate a legacy user-data directory into the target
 * path. `migrated` is true when the legacy directory was moved; `merged` is
 * true when the target already existed and the legacy contents were merged in.
 */
export interface DataDirectoryMigrationResult {
  migrated: boolean;
  merged: boolean;
  targetPath: string;
  legacyPath?: string;
}

/**
 * Move or merge a legacy user-data directory into the target path.
 *
 * The migration is idempotent: when neither directory exists it is a no-op, and
 * when the target already exists the legacy directory is merged into it without
 * overwriting existing files. The legacy directory is removed only when it was
 * fully moved (not merged), so a crash mid-merge leaves the legacy copy intact.
 *
 * This is the single place the legacy name is referenced, so renaming the app's
 * data directory later is a one-line change instead of a scattered set of
 * `renameSync` calls in the main process.
 */
export function migrateDataDirectory(
  appDataDirectory: string,
  legacyName: string,
  targetName: string
): DataDirectoryMigrationResult {
  const targetPath = join(appDataDirectory, targetName);
  const legacyPath = join(appDataDirectory, legacyName);

  if (!existsSync(legacyPath)) {
    return { migrated: false, merged: false, targetPath };
  }

  if (existsSync(targetPath)) {
    // Merge without overwriting: `force: false` keeps the target's existing
    // files, and `errorOnExist: false` tolerates the target already holding a
    // subtree with the same name.
    cpSync(legacyPath, targetPath, { recursive: true, force: false, errorOnExist: false });
    return { migrated: false, merged: true, targetPath, legacyPath };
  }

  renameSync(legacyPath, targetPath);
  return { migrated: true, merged: false, targetPath, legacyPath };
}

/**
 * Resolve the per-user data directory for the app, migrating the legacy
 * `BroxPrint Studio` directory into `AlifShohojPrint` when present.
 *
 * The legacy name is passed explicitly so the migration stays testable and the
 * next rename does not require touching the main-process wiring.
 */
export function resolveUserDataDirectory(appDataDirectory: string): string {
  const targetName = 'AlifShohojPrint';
  const legacyName = 'BroxPrint Studio';
  migrateDataDirectory(appDataDirectory, legacyName, targetName);
  return join(appDataDirectory, targetName);
}