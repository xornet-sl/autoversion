import SemVer from "semver/classes/semver";
import semver_inc from "semver/functions/inc";
import { context } from "@actions/github";
import { getMessagesBetween } from "./git";

export type BumpFunctionParams = {
  breakingChangeRegexp?: RegExp;
  minorChangeRegexp?: RegExp;
  onTag: boolean;
  onReleaseBranch: boolean;
  prereleaseHint?: string;
  commitSequence?: number;
  build?: string;
};

export type BumpFunctionType = (
  baseVersion: SemVer,
  baseTag: string | undefined,
  params: BumpFunctionParams
) => Promise<SemVer>;
export type BumpFunctionsType = Record<"auto" | "major" | "minor" | "patch", BumpFunctionType>;

export const BumpFunctions: BumpFunctionsType = {
  major: async (baseVersion, _, params) => {
    return setTail(new SemVer(semver_inc(baseVersion, "major")!), params);
  },
  minor: async (baseVersion, _, params) => {
    return setTail(new SemVer(semver_inc(baseVersion, "minor")!), params);
  },
  patch: async (baseVersion, _, params) => {
    return setTail(new SemVer(semver_inc(baseVersion, "patch")!), params);
  },
  auto: async (baseVersion, baseTag, params) => {
    if (!baseTag) {
      return setTail(new SemVer(semver_inc(baseVersion, "patch")!), params);
    }

    const commitMessages = await getMessagesBetween(baseTag, context.sha);
    const messages = commitMessages.split("\n").map((msg) => msg.trim());

    let isFeature = false;
    for (const message of messages) {
      if (params.breakingChangeRegexp && params.breakingChangeRegexp.test(message)) {
        return setTail(new SemVer(semver_inc(baseVersion, "major")!), params);
      }
      if (params.minorChangeRegexp && params.minorChangeRegexp.test(message)) {
        isFeature = true;
      }
    }
    if (isFeature) {
      return setTail(new SemVer(semver_inc(baseVersion, "minor")!), params);
    }
    return setTail(new SemVer(semver_inc(baseVersion, "patch")!), params);
  },
};

function setTail(version: SemVer, params: BumpFunctionParams): SemVer {
  if (params.onTag) {
    return version;
  }
  let returnVersion = `${version.major}.${version.minor}.${version.patch}`;
  if (params.onReleaseBranch) {
    return new SemVer(returnVersion);
  }
  const prerelease: string[] = [];
  if (params.prereleaseHint !== undefined) {
    prerelease.push(params.prereleaseHint);
  }
  if (params.commitSequence !== undefined) {
    prerelease.push(`${params.commitSequence}`);
  }
  if (prerelease.length > 0) {
    returnVersion += `-${prerelease.join(".")}`;
  }
  if (params.build !== undefined) {
    returnVersion += `+${params.build}`;
  }
  return new SemVer(returnVersion);
}
