import { assert } from "chai";

import { buildModule } from "../../src/new-api/build-module";

describe("libraryFromArtifact", () => {
  const fakeArtifact: any = {};

  it("should be able to deploy with a library based on an artifact", () => {
    const moduleWithContractFromArtifact = buildModule("Module1", (m) => {
      const library1 = m.libraryFromArtifact("Library1", fakeArtifact);

      return { library1 };
    });

    assert.isDefined(moduleWithContractFromArtifact);

    // Sets ids based on module id and contract name
    assert.equal(moduleWithContractFromArtifact.id, "Module1");
    assert.equal(
      moduleWithContractFromArtifact.results.library1.id,
      "Module1:Library1"
    );

    // 1 contract future
    assert.equal(moduleWithContractFromArtifact.futures.size, 1);

    // No submodules
    assert.equal(moduleWithContractFromArtifact.submodules.size, 0);
  });

  it("should be able to pass an after dependency", () => {
    const moduleWithDependentContracts = buildModule("Module1", (m) => {
      const example = m.library("Example");
      const another = m.libraryFromArtifact("Another", fakeArtifact, {
        after: [example],
      });

      return { example, another };
    });

    assert.equal(moduleWithDependentContracts.futures.size, 2);

    const exampleFuture = moduleWithDependentContracts.results.example;
    const anotherFuture = moduleWithDependentContracts.results.another;

    assert.equal(anotherFuture.dependencies.size, 1);
    assert(anotherFuture.dependencies.has(exampleFuture!));
  });

  describe("passing id", () => {
    it("should use library from artifact twice by passing an id", () => {
      const moduleWithSameContractTwice = buildModule("Module1", (m) => {
        const sameContract1 = m.libraryFromArtifact(
          "SameContract",
          fakeArtifact,
          { id: "first" }
        );
        const sameContract2 = m.libraryFromArtifact(
          "SameContract",
          fakeArtifact,
          {
            id: "second",
          }
        );

        return { sameContract1, sameContract2 };
      });

      // Sets ids based on module id and contract name
      assert.equal(moduleWithSameContractTwice.id, "Module1");
      assert.equal(
        moduleWithSameContractTwice.results.sameContract1.id,
        "Module1:first"
      );
      assert.equal(
        moduleWithSameContractTwice.results.sameContract2.id,
        "Module1:second"
      );
    });

    it("should throw if the same library is deployed twice without differentiating ids", () => {
      assert.throws(() => {
        buildModule("Module1", (m) => {
          const sameContract1 = m.libraryFromArtifact(
            "SameContract",
            fakeArtifact
          );
          const sameContract2 = m.libraryFromArtifact(
            "SameContract",
            fakeArtifact
          );

          return { sameContract1, sameContract2 };
        });
      }, /Contracts must have unique ids, Module1:SameContract has already been used/);
    });

    it("should throw if a library tries to pass the same id twice", () => {
      assert.throws(() => {
        buildModule("Module1", (m) => {
          const sameContract1 = m.libraryFromArtifact(
            "SameContract",
            fakeArtifact,
            {
              id: "same",
            }
          );
          const sameContract2 = m.libraryFromArtifact(
            "SameContract",
            fakeArtifact,
            {
              id: "same",
            }
          );

          return { sameContract1, sameContract2 };
        });
      }, /Contracts must have unique ids, Module1:same has already been used/);
    });
  });
});