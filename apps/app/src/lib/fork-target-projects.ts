import {
  PERSONAL_WORKSPACE_ENVIRONMENT_PROVIDER_ID,
  PROJECT_CHECKOUT_ENVIRONMENT_PROVIDER_ID,
  type AppCreateThreadRequest,
} from "@bb/client-core";
import {
  findLocalPathProjectSourceForHost,
  PERSONAL_PROJECT_ID,
  type ProjectSource,
} from "@bb/domain";

export interface ForkTargetProject {
  id: string;
  name: string;
}

interface ForkTargetProjectCandidate extends ForkTargetProject {
  sources: readonly ProjectSource[];
}

export function listForkTargetProjects({
  hostId,
  personalProject,
  projects,
  sourceProjectId,
}: {
  hostId: string | null;
  personalProject: ForkTargetProjectCandidate | undefined;
  projects: readonly ForkTargetProjectCandidate[];
  sourceProjectId: string;
}): ForkTargetProject[] {
  if (hostId === null) return [];
  const candidates = [
    ...(personalProject ? [personalProject] : []),
    ...projects.filter(
      (project) =>
        findLocalPathProjectSourceForHost(project.sources, hostId) !==
        undefined,
    ),
  ];
  return candidates
    .filter((project) => project.id !== sourceProjectId)
    .map(({ id, name }) => ({ id, name }));
}

export function buildForkIntoProjectEnvironment({
  hostId,
  projectId,
}: {
  hostId: string;
  projectId: string;
}): AppCreateThreadRequest["environment"] {
  const isPersonal = projectId === PERSONAL_PROJECT_ID;
  return {
    type: "provider",
    environmentProviderId: isPersonal
      ? PERSONAL_WORKSPACE_ENVIRONMENT_PROVIDER_ID
      : PROJECT_CHECKOUT_ENVIRONMENT_PROVIDER_ID,
    machine: { type: "existing", hostId },
    inputs: isPersonal ? null : {},
  };
}
