import { getBooleanInput, getInput, setOutput } from "@actions/core";
import { context } from "@actions/github";
import { PushEvent, PullRequestEvent } from "@octokit/webhooks-types";
import SemVer from "semver/classes/semver";
import semver_parse from "semver/functions/parse";

import { getLastVersionTag, getTagSHA, getDistanceBetweenCommits, getShortSHA } from "./git";
import { BumpFunctions, BumpFunctionsType } from "./bump";
import { getVersionFromTag, getTagFromVersion } from "./utils";

const branchSanitizer = (branch: string): string => {
  return branch.replace(/[^a-zA-Z0-9-]/g, "");
};

export async function run(): Promise<void> {
  const tagPrefix = getInput("tag_prefix");
  const searchTagsGlobally = getBooleanInput("search_tags_globally");
  const releaseBranchRegexp =
    getInput("release_branch_regexp").length > 0 ? new RegExp(getInput("release_branch_regexp"), "i") : undefined;
  const breakingChangeRegexp =
    getInput("breaking_change_regexp").length > 0 ? new RegExp(getInput("breaking_change_regexp"), "i") : undefined;
  const minorChangeRegexp =
    getInput("minor_change_regexp").length > 0 ? new RegExp(getInput("minor_change_regexp"), "i") : undefined;
  const bumpType = getInput("bump_type");
  if (!Object.keys(BumpFunctions).includes(bumpType)) {
    throw new Error(`Invalid bump_type: ${bumpType}`);
  }

  let lastTag: string | undefined;
  let lastTagSHA: string | undefined;
  let onTag = false;
  let prereleaseHint: string | undefined;
  let onReleaseBranch = false;

  if (context.eventName === "push") {
    const pushEvent = context.payload as PushEvent;
    if (pushEvent.ref.startsWith("refs/tags/")) {
      const tag = pushEvent.ref.replace("refs/tags/", "");
      if (tagPrefix.length > 0 && tag.startsWith(tagPrefix) && semver_parse(tag) !== null) {
        lastTag = tag;
        lastTagSHA = pushEvent.after;
        onTag = true;
      } else {
        throw new Error(`Tag ${tag} is not a version tag`);
      }
    } else if (pushEvent.ref.startsWith("refs/heads/")) {
      const branch = pushEvent.ref.replace("refs/heads/", "");
      if (releaseBranchRegexp && releaseBranchRegexp.test(branch)) {
        onReleaseBranch = true;
      } else {
        prereleaseHint = branchSanitizer(branch);
      }
    }
  }
  if (["pull_request", "pull_request_target"].includes(context.eventName)) {
    const pullRequestEvent = context.payload as PullRequestEvent;
    prereleaseHint = `pr-${pullRequestEvent.number}`;
  }
  // On pull_request and on push to branch, get the last tag from the current commit

  if (lastTag === undefined) {
    lastTag = await getLastVersionTag(tagPrefix, searchTagsGlobally);
    lastTagSHA = await getTagSHA(lastTag);
    onTag = lastTagSHA === context.sha;
  }
  const lastVersion = getVersionFromTag(tagPrefix, lastTag);

  const bumpFunction = BumpFunctions[bumpType as keyof BumpFunctionsType];
  let nextVersion: SemVer;
  if (onTag) {
    nextVersion = lastVersion;
  } else {
    nextVersion = await bumpFunction(lastVersion, lastTag, {
      breakingChangeRegexp,
      minorChangeRegexp,
      onTag,
      onReleaseBranch,
      prereleaseHint,
      commitSequence: await getDistanceBetweenCommits(lastTagSHA, context.sha),
      build: ["pull_request", "pull_request_target"].includes(context.eventName)
        ? undefined
        : await getShortSHA(context.sha),
    });
  }

  setOutput("last_tag", lastTag ?? "");
  setOutput("last_tag_sha", lastTagSHA ?? "");
  setOutput("last_version", lastVersion.format());
  setOutput("suggested_version", nextVersion.raw);
  setOutput("suggested_tag", getTagFromVersion(tagPrefix, nextVersion));
  setOutput("on_tag", onTag.toString());
  setOutput("on_release_branch", onReleaseBranch.toString());
  setOutput("is_release_version", (nextVersion.prerelease.length == 0 && nextVersion.build.length == 0).toString());
}
