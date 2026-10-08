import { PERSONAL_PROJECT_ID, type ProjectSource } from "@bb/domain";
import { describe, expect, it } from "vitest";
import {
  buildForkIntoProjectEnvironment,
  listForkTargetProjects,
} from "./fork-target-projects";

function localSource(projectId: string, hostId: string): ProjectSource {
  return {
    createdAt: 0,
    hostId,
    id: `src_${projectId}_${hostId}`,
    isDefault: true,
    path: `/repos/${projectId}`,
    projectId,
    type: "local_path",
    updatedAt: 0,
  };
}

const personalProject = {
  id: PERSONAL_PROJECT_ID,
  name: "Personal",
  sources: [],
};

describe("listForkTargetProjects", () => {
  it("offers Personal and projects checked out on the source host, except the source project", () => {
    expect(
      listForkTargetProjects({
        hostId: "host_local",
        personalProject,
        projects: [
          {
            id: "proj_source",
            name: "Source",
            sources: [localSource("proj_source", "host_local")],
          },
          {
            id: "proj_here",
            name: "Here",
            sources: [localSource("proj_here", "host_local")],
          },
          {
            id: "proj_elsewhere",
            name: "Elsewhere",
            sources: [localSource("proj_elsewhere", "host_remote")],
          },
        ],
        sourceProjectId: "proj_source",
      }),
    ).toEqual([
      { id: PERSONAL_PROJECT_ID, name: "Personal" },
      { id: "proj_here", name: "Here" },
    ]);
  });

  it("leaves Personal out when the source already lives there", () => {
    expect(
      listForkTargetProjects({
        hostId: "host_local",
        personalProject,
        projects: [],
        sourceProjectId: PERSONAL_PROJECT_ID,
      }),
    ).toEqual([]);
  });

  it("offers nothing until the source host is known", () => {
    expect(
      listForkTargetProjects({
        hostId: null,
        personalProject,
        projects: [],
        sourceProjectId: "proj_source",
      }),
    ).toEqual([]);
  });
});

describe("buildForkIntoProjectEnvironment", () => {
  it("creates a personal workspace on the source host for Personal", () => {
    expect(
      buildForkIntoProjectEnvironment({
        hostId: "host_local",
        projectId: PERSONAL_PROJECT_ID,
      }),
    ).toEqual({
      type: "provider",
      environmentProviderId: "personal-workspace",
      machine: { type: "existing", hostId: "host_local" },
      inputs: null,
    });
  });

  it("uses the project checkout on the source host for other projects", () => {
    expect(
      buildForkIntoProjectEnvironment({
        hostId: "host_local",
        projectId: "proj_here",
      }),
    ).toEqual({
      type: "provider",
      environmentProviderId: "project-checkout",
      machine: { type: "existing", hostId: "host_local" },
      inputs: {},
    });
  });
});
