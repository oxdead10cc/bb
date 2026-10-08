import { isProcessGroupAlive, supportsProcessGroups } from "./process-group.js";
import { spawnPortableOutputProcess } from "./spawn.js";

export interface ProcessSnapshot {
  pid: number;
  ppid: number;
  pgid: number;
  command: string;
}

const PROCESS_SNAPSHOT_LINE = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/;

function processSnapshotPsArgs(): string[] {
  return process.platform === "linux"
    ? ["-ww", "-eo", "pid=,ppid=,pgid=,args="]
    : ["-axww", "-o", "pid=,ppid=,pgid=,command="];
}

function parseProcessSnapshots(output: string): ProcessSnapshot[] {
  const snapshots: ProcessSnapshot[] = [];
  for (const line of output.split("\n")) {
    const match = PROCESS_SNAPSHOT_LINE.exec(line);
    if (!match) {
      const previous = snapshots.at(-1);
      if (previous && line !== "") {
        previous.command = `${previous.command}\n${line}`;
      }
      continue;
    }
    snapshots.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      pgid: Number(match[3]),
      command: match[4] ?? "",
    });
  }
  return snapshots;
}

export async function listProcessSnapshots(): Promise<ProcessSnapshot[]> {
  if (process.platform === "win32") {
    return [];
  }
  const child = spawnPortableOutputProcess({
    command: "ps",
    args: processSnapshotPsArgs(),
  });
  const chunks: Buffer[] = [];
  child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  child.stderr.resume();
  await new Promise<void>((resolveExit) => {
    child.once("error", () => resolveExit());
    child.once("exit", () => resolveExit());
  });
  return parseProcessSnapshots(Buffer.concat(chunks).toString("utf8"));
}

export function collectDescendantPids(
  snapshots: ProcessSnapshot[],
  rootPid: number,
): Set<number> {
  const childrenByParent = new Map<number, number[]>();
  for (const snapshot of snapshots) {
    const siblings = childrenByParent.get(snapshot.ppid);
    if (siblings) {
      siblings.push(snapshot.pid);
    } else {
      childrenByParent.set(snapshot.ppid, [snapshot.pid]);
    }
  }
  const descendants = new Set<number>();
  const queue = [rootPid];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }
    for (const child of childrenByParent.get(current) ?? []) {
      if (descendants.has(child)) {
        continue;
      }
      descendants.add(child);
      queue.push(child);
    }
  }
  return descendants;
}

const MIN_COMMAND_MATCH_NEEDLE_LENGTH = 6;

export function commandMatchNeedle(commandText: string): string | null {
  const firstLine = commandText.split("\n")[0]?.trim() ?? "";
  const quoteIndex = firstLine.search(/['"\\]/u);
  const needle = (
    quoteIndex === -1 ? firstLine : firstLine.slice(0, quoteIndex)
  ).trim();
  return needle.length >= MIN_COMMAND_MATCH_NEEDLE_LENGTH ? needle : null;
}

interface FindDescendantCommandProcessesArgs {
  rootPid: number;
  commandText: string;
  snapshots?: ProcessSnapshot[];
}

export async function findDescendantCommandProcesses(
  args: FindDescendantCommandProcessesArgs,
): Promise<ProcessSnapshot[]> {
  const needle = commandMatchNeedle(args.commandText);
  if (needle === null) {
    return [];
  }
  const snapshots = args.snapshots ?? (await listProcessSnapshots());
  const descendants = collectDescendantPids(snapshots, args.rootPid);
  const matches = snapshots.filter(
    (snapshot) =>
      descendants.has(snapshot.pid) && snapshot.command.includes(needle),
  );
  const matchedPids = new Set(matches.map((snapshot) => snapshot.pid));
  const byPid = new Map(snapshots.map((snapshot) => [snapshot.pid, snapshot]));
  return matches.filter((snapshot) => {
    let parent = byPid.get(snapshot.ppid);
    while (parent !== undefined && descendants.has(parent.pid)) {
      if (matchedPids.has(parent.pid)) {
        return false;
      }
      parent = byPid.get(parent.ppid);
    }
    return true;
  });
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

interface InterruptProcessArgs {
  snapshot: ProcessSnapshot;
  graceMs: number;
}

const PROCESS_EXIT_POLL_MS = 50;

export async function interruptProcess(
  args: InterruptProcessArgs,
): Promise<boolean> {
  const { snapshot } = args;
  const groupWide = supportsProcessGroups() && snapshot.pgid === snapshot.pid;
  const target = groupWide ? -snapshot.pid : snapshot.pid;
  const stillRunning = (): boolean =>
    groupWide
      ? isProcessGroupAlive({ pid: snapshot.pid })
      : isProcessAlive(snapshot.pid);
  try {
    process.kill(target, "SIGINT");
  } catch {
    return false;
  }
  const deadline = Date.now() + args.graceMs;
  while (Date.now() < deadline) {
    if (!stillRunning()) {
      return true;
    }
    await delay(PROCESS_EXIT_POLL_MS);
  }
  try {
    process.kill(target, "SIGKILL");
  } catch {}
  return true;
}
