import exec from "@actions/exec";
import { info } from "@actions/core";
import semver_parse from "semver/functions/parse";

export async function getLastVersionTag(tagPrefix: string, searchTagsGlobally: boolean): Promise<string | undefined> {
  let output = "";
  const options: exec.ExecOptions = {
    silent: true,
    ignoreReturnCode: true,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
    },
  };
  // --first-parent ?
  const retcode = searchTagsGlobally
    ? await exec.exec("sh", ["-c", "git describe --tags $(git rev-list --tags)"], options)
    : await exec.exec("git", ["tag", "--sort", "-creatordate", "--merged"], options);
  if (retcode !== 0) {
    return undefined;
  }
  output = output.trim();
  if (output.length === 0) {
    return undefined;
  }

  const tags = output.split("\n").map((t) => t.trim());
  for (const tag of tags) {
    const vtag = tagPrefix.length > 0 && tag.startsWith(tagPrefix) ? tag.substring(tagPrefix.length) : tag;
    const parsed = semver_parse(vtag);
    if (parsed === null) {
      continue;
    }

    if (parsed.prerelease.length > 0 || parsed.build.length > 0) {
      info(`Ignoring tag ${tag} because it is a pre-release or build tag`);
      continue;
    }
    info(`Found last version tag ${tag}`);
    return tag;
  }
  return undefined;
}

export async function getTagSHA(tag?: string): Promise<string | undefined> {
  if (!tag) {
    return undefined;
  }
  let output = "";
  const options: exec.ExecOptions = {
    silent: true,
    ignoreReturnCode: true,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
    },
  };
  const retcode = await exec.exec("git", ["rev-list", "-n", "1", tag], options);
  if (retcode !== 0) {
    return undefined;
  }
  output = output.trim();
  if (output.length === 0) {
    return undefined;
  }
  return output;
}

export async function getMessagesBetween(base?: string, target?: string): Promise<string> {
  if (!base || !target) {
    return "";
  }
  let output = "";
  let error = "";
  const options: exec.ExecOptions = {
    silent: true,
    ignoreReturnCode: true,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
      stderr: (data: Buffer) => {
        error += data.toString();
      },
    },
  };
  const retcode = await exec.exec("git", ["log", "--format='%B'", base + ".." + target], options);
  if (retcode !== 0) {
    throw new Error("Failed to get commit messages between " + base + " and " + target + ": " + error);
  }
  output = output.trim();
  if (output.length === 0) {
    throw new Error("No commit messages found between " + base + " and " + target);
  }
  return output;
}

export async function getDistanceBetweenCommits(base?: string, target?: string): Promise<number> {
  if (!base || !target || base === target) {
    return 0;
  }
  let output = "";
  const options: exec.ExecOptions = {
    silent: true,
    ignoreReturnCode: true,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
    },
  };
  const retcode = await exec.exec("git", ["rev-list", "--count", base + ".." + target], options);
  if (retcode !== 0) {
    throw new Error("Failed to get distance between commits " + base + " and " + target);
  }
  output = output.trim();
  if (output.length === 0) {
    throw new Error("No distance found between commits " + base + " and " + target);
  }
  return parseInt(output, 10);
}

export async function getShortSHA(sha?: string): Promise<string> {
  const point = sha ?? "HEAD";
  let output = "";
  let error = "";
  const options: exec.ExecOptions = {
    silent: true,
    ignoreReturnCode: true,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
      stderr: (data: Buffer) => {
        error += data.toString();
      },
    },
  };
  const retcode = await exec.exec("git", ["rev-parse", "--short", point], options);
  if (retcode !== 0) {
    throw new Error(`Failed to get short SHA for ${point}: ${error}`);
  }
  output = output.trim();
  if (output.length === 0) {
    throw new Error(`Failed to get short SHA for ${point}: empty output`);
  }
  return output;
}
