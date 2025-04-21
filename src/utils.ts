import SemVer from "semver/classes/semver";

export function getVersionFromTag(tagPrefix: string, tag?: string): SemVer {
  if (!tag) {
    return new SemVer("0.0.0")!;
  }
  const version = tag.startsWith(tagPrefix) ? tag.substring(tagPrefix.length) : tag;
  return new SemVer(version);
}

export function getTagFromVersion(tagPrefix: string, version: SemVer): string {
  return `${tagPrefix}${version.raw}`;
}
